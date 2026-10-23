//! Domain types for conversations and their messages. Each backend maps
//! its own row representation onto these types.

use chrono::{DateTime, Utc};
use uuid::Uuid;

/// A conversation owned by a user.
#[derive(Debug, Clone)]
pub struct Conversation {
    /// Conversation id.
    pub id: Uuid,
    /// Owning user.
    pub user_id: Uuid,
    /// Display title.
    pub title: String,
    /// Active branch leaf message id; `None` when empty.
    pub leaf_id: Option<Uuid>,
    /// Model last used in this conversation; `None` before the first turn.
    pub last_model: Option<LastModel>,
    /// Creation time.
    pub created_at: DateTime<Utc>,
    /// Last update time.
    pub updated_at: DateTime<Utc>,
}

/// The model selection last used in a conversation, restored when the
/// conversation is reopened.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct LastModel {
    /// Provider the turn was dispatched to.
    pub provider_id: Uuid,
    /// Model identifier as configured on the provider.
    pub model: String,
    /// Reasoning effort level, when the model exposes one.
    pub thinking_effort: Option<String>,
}

/// A message in a conversation tree.
#[derive(Debug, Clone)]
pub struct Message {
    /// Message id.
    pub id: Uuid,
    /// Owning conversation.
    pub conversation_id: Uuid,
    /// Parent message in the conversation tree; `None` for roots.
    pub parent_id: Option<Uuid>,
    /// Canonical message body.
    pub message: lemma_core::Message,
    /// Lifecycle status of the entry.
    pub status: MessageStatus,
    /// Failure reason when status is `Error`; `None` otherwise.
    pub error: Option<String>,
    /// Provider row the message was dispatched to, when known.
    pub provider_id: Option<Uuid>,
    /// Model identifier that produced the entry, when known.
    pub model: Option<String>,
    /// Creation time.
    pub created_at: DateTime<Utc>,
    /// Last update time.
    pub updated_at: DateTime<Utc>,
}

impl Message {
    /// Authoring role string: `user`, `assistant`, or `tool`.
    #[must_use]
    pub fn role(&self) -> &'static str {
        match &self.message {
            lemma_core::Message::User { .. } => "user",
            lemma_core::Message::Assistant { .. } => "assistant",
            lemma_core::Message::ToolResult { .. } => "tool",
        }
    }
}

/// Lifecycle status of a stored message.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MessageStatus {
    /// Generation in progress; the row is a placeholder.
    Streaming,
    /// Generation completed normally.
    Done,
    /// Generation cancelled by the user.
    Aborted,
    /// Generation failed.
    Error,
}

impl MessageStatus {
    /// Status string as persisted: `streaming`, `done`, `aborted`, or
    /// `error`.
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Streaming => "streaming",
            Self::Done => "done",
            Self::Aborted => "aborted",
            Self::Error => "error",
        }
    }
}

/// Finalization payload applied to a placeholder message when its
/// generation settles.
#[derive(Debug, Clone)]
pub struct MessageUpdate {
    /// Final canonical message body.
    pub message: lemma_core::Message,
    /// Terminal lifecycle status.
    pub status: MessageStatus,
    /// Failure reason when status is `Error`; `None` otherwise.
    pub error: Option<String>,
}

/// One page of a conversation's messages, newest first.
#[derive(Debug, Clone)]
pub struct MessagePage {
    /// Messages on this page.
    pub messages: Vec<Message>,
    /// Whether older messages follow this page.
    pub has_more: bool,
}
