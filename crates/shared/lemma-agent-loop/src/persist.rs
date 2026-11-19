use chrono::Utc;
use lemma_core::{ContentBlock, Message, StopReason, TextContent, ToolCall};
use lemma_model::ApiFormat;
use lemma_session::{Message as StoredMessage, MessageBody, MessageStatus, MessageUpdate};
use uuid::Uuid;

use crate::stream::{StepEnd, StepOutcome};
use crate::tool_runtime::ToolOutcome;

pub(crate) fn settled(
    id: Uuid,
    session_id: Uuid,
    parent_id: Option<Uuid>,
    message: Message,
) -> StoredMessage {
    let now = Utc::now();
    StoredMessage {
        id,
        session_id,
        parent_id,
        body: MessageBody(message),
        status: MessageStatus::Done,
        error: None,
        model: None,
        provider_id: None,
        api_format: None,
        label: None,
        created_at: now,
        updated_at: now,
    }
}

pub(crate) fn placeholder(
    id: Uuid,
    session_id: Uuid,
    parent_id: Uuid,
    model: &str,
    provider_id: Uuid,
    api_format: ApiFormat,
) -> StoredMessage {
    let now = Utc::now();
    StoredMessage {
        id,
        session_id,
        parent_id: Some(parent_id),
        body: MessageBody(Message::Assistant {
            content: vec![ContentBlock::Text(TextContent {
                text: String::new(),
            })],
            stop_reason: StopReason::Stop,
            usage: None,
        }),
        status: MessageStatus::Streaming,
        error: None,
        model: Some(model.to_string()),
        provider_id: Some(provider_id),
        api_format: Some(api_format),
        label: None,
        created_at: now,
        updated_at: now,
    }
}

pub(crate) fn settle(outcome: &StepOutcome) -> MessageUpdate {
    let (status, error) = match &outcome.end {
        StepEnd::Completed => (MessageStatus::Done, None),
        StepEnd::Failed(message) => (MessageStatus::Error, Some(message.clone())),
        StepEnd::Aborted => (MessageStatus::Aborted, None),
    };
    MessageUpdate {
        body: MessageBody(Message::Assistant {
            content: outcome.content(),
            stop_reason: outcome.stop_reason,
            usage: outcome.usage,
        }),
        status,
        error,
    }
}

pub(crate) fn tool_result(call: &ToolCall, outcome: ToolOutcome) -> Message {
    Message::ToolResult {
        tool_call_id: call.id.clone(),
        tool_name: call.name.clone(),
        content: vec![ContentBlock::Text(TextContent { text: outcome.text })],
        is_error: outcome.is_error,
    }
}
