use chrono::{DateTime, Utc};
use lemma_core::Message as CoreMessage;
use lemma_model::ApiFormat;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::session_error::SessionError;

/// One persisted message node in a session's tree.
#[derive(Debug, Clone, PartialEq)]
pub struct Message {
    /// Message id.
    pub id: Uuid,
    /// Owning session id.
    pub session_id: Uuid,
    /// Parent message id; `None` for root messages.
    pub parent_id: Option<Uuid>,
    /// Canonical message body.
    pub body: MessageBody,
    /// Lifecycle status.
    pub status: MessageStatus,
    /// Failure reason when `status` is [`MessageStatus::Error`].
    pub error: Option<String>,
    /// Provider id used to generate this message, when applicable.
    pub provider_id: Option<Uuid>,
    /// Model id used to generate this message, when applicable.
    pub model: Option<String>,
    /// API format used to generate this message, when applicable.
    pub api_format: Option<ApiFormat>,
    /// Optional user-assigned branch label.
    pub label: Option<String>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last modification timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Canonical message payload stored as JSON.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct MessageBody(pub CoreMessage);

/// Lifecycle status of a stored message.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageStatus {
    /// Assistant turn is actively streaming.
    Streaming,
    /// Assistant turn completed or user/tool message is settled.
    Done,
    /// Assistant turn was aborted before completion.
    Aborted,
    /// Assistant turn ended with an error.
    Error,
}

impl Message {
    /// Authoring role string: `user`, `assistant`, or `tool`.
    #[must_use]
    pub fn role(&self) -> &'static str {
        match &self.body.0 {
            CoreMessage::User { .. } => "user",
            CoreMessage::Assistant { .. } => "assistant",
            CoreMessage::ToolResult { .. } => "tool",
        }
    }
}

impl MessageStatus {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Streaming => "streaming",
            Self::Done => "done",
            Self::Aborted => "aborted",
            Self::Error => "error",
        }
    }

    pub(crate) fn parse(raw: &str) -> Result<Self, SessionError> {
        match raw {
            "streaming" => Ok(Self::Streaming),
            "done" => Ok(Self::Done),
            "aborted" => Ok(Self::Aborted),
            "error" => Ok(Self::Error),
            other => Err(SessionError::Store(format!(
                "unknown message status: {other}"
            ))),
        }
    }
}

#[cfg(test)]
mod tests {
    use chrono::Utc;
    use lemma_core::{Message as CoreMessage, StopReason};
    use uuid::Uuid;

    use super::{Message, MessageBody, MessageStatus};

    fn sample(body: CoreMessage) -> Message {
        let now = Utc::now();
        Message {
            id: Uuid::new_v4(),
            session_id: Uuid::new_v4(),
            parent_id: None,
            body: MessageBody(body),
            status: MessageStatus::Done,
            error: None,
            provider_id: None,
            model: None,
            api_format: None,
            label: None,
            created_at: now,
            updated_at: now,
        }
    }

    #[test]
    fn message_roles_and_wire_encodings_round_trip() {
        let user = sample(CoreMessage::User {
            content: Vec::new(),
        });
        let assistant = sample(CoreMessage::Assistant {
            content: Vec::new(),
            stop_reason: StopReason::Stop,
            usage: None,
        });
        let tool = sample(CoreMessage::ToolResult {
            tool_call_id: "call-1".to_owned(),
            tool_name: "read_file".to_owned(),
            content: Vec::new(),
            is_error: false,
        });

        assert_eq!(user.role(), "user", "user role");
        assert_eq!(assistant.role(), "assistant", "assistant role");
        assert_eq!(tool.role(), "tool", "tool role");

        for status in [
            MessageStatus::Streaming,
            MessageStatus::Done,
            MessageStatus::Aborted,
            MessageStatus::Error,
        ] {
            assert_eq!(
                MessageStatus::parse(status.as_str()).ok(),
                Some(status),
                "status round-trip"
            );
        }
        assert!(
            MessageStatus::parse("bogus").is_err(),
            "unknown status rejected"
        );
    }
}
