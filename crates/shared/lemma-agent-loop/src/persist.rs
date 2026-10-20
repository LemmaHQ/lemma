use chrono::{DateTime, Utc};
use lemma_conversation::{Message as StoredMessage, MessageStatus, MessageUpdate};
use lemma_core::{ContentBlock, Message, StopReason, TextContent, ToolCall};
use uuid::Uuid;

use crate::stream::{StepEnd, StepOutcome};

pub(crate) fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as i64)
}

/// A settled message without model attribution: the user message or a
/// tool result.
pub(crate) fn settled(
    id: Uuid,
    conversation_id: Uuid,
    parent_id: Option<Uuid>,
    message: Message,
) -> StoredMessage {
    let now = Utc::now();
    StoredMessage {
        id,
        conversation_id,
        parent_id,
        message,
        status: MessageStatus::Done,
        error: None,
        model: None,
        provider_id: None,
        created_at: now,
        updated_at: now,
    }
}

/// The streaming assistant placeholder a step appends before calling the
/// model.
pub(crate) fn placeholder(
    id: Uuid,
    conversation_id: Uuid,
    parent_id: Uuid,
    model: &str,
    provider_id: Uuid,
    started_at: i64,
) -> StoredMessage {
    let created = DateTime::from_timestamp_millis(started_at).unwrap_or(DateTime::UNIX_EPOCH);
    StoredMessage {
        id,
        conversation_id,
        parent_id: Some(parent_id),
        message: Message::Assistant {
            content: vec![ContentBlock::Text(TextContent {
                text: String::new(),
            })],
            stop_reason: StopReason::Stop,
            usage: None,
        },
        status: MessageStatus::Streaming,
        error: None,
        model: Some(model.to_string()),
        provider_id: Some(provider_id),
        created_at: created,
        updated_at: created,
    }
}

/// The final state of a placeholder once its stream has settled.
pub(crate) fn settle(outcome: &StepOutcome) -> MessageUpdate {
    let (status, error) = match &outcome.end {
        StepEnd::Completed => (MessageStatus::Done, None),
        StepEnd::Failed(message) => (MessageStatus::Error, Some(message.clone())),
        StepEnd::Aborted => (MessageStatus::Aborted, None),
    };
    MessageUpdate {
        message: Message::Assistant {
            content: outcome.content(),
            stop_reason: outcome.stop_reason,
            usage: outcome.usage,
        },
        status,
        error,
        first_token_at: outcome.first_token_at,
        finished_at: now_ms(),
    }
}

/// The tool result message answering `call`.
pub(crate) fn tool_result(call: &ToolCall, text: String, is_error: bool) -> Message {
    Message::ToolResult {
        tool_call_id: call.id.clone(),
        tool_name: call.name.clone(),
        content: vec![ContentBlock::Text(TextContent { text })],
        is_error,
    }
}
