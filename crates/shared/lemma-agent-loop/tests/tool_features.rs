//! Requests to a model with tool calling disabled.

mod common;

use std::env;
use std::error::Error;
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::{Arc, Mutex, PoisonError};

use chrono::DateTime;
use futures::stream;
use lemma_agent_loop::{AgentLoop, ToolRuntime};
use lemma_core::{
    ContentBlock, Message, StopReason, StreamEvent, TextContent, ThinkingContent, ToolCall,
};
use lemma_model::{Adapter, BoxEventStream, ModelError, ModelRequest};
use lemma_session::{Message as StoredMessage, MessageBody, MessageStatus};
use lemma_tool::{CancelToken, LocalExecEnv, ReadFileTool, ToolRegistry};
use serde_json::json;
use uuid::Uuid;

use crate::common::{input, new_session};

static NEXT_MILLIS: AtomicI64 = AtomicI64::new(1_700_000_000_000);

#[derive(Debug)]
struct Recorded {
    tools: usize,
    messages: Vec<Message>,
}

struct RecordingAdapter(Arc<Mutex<Option<Recorded>>>);

impl Adapter for RecordingAdapter {
    async fn stream(&self, req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        *self.0.lock().unwrap_or_else(PoisonError::into_inner) = Some(Recorded {
            tools: req.tools.len(),
            messages: req.messages,
        });
        Ok(Box::pin(stream::iter([
            Ok(StreamEvent::TextDelta {
                delta: "done".to_owned(),
            }),
            Ok(StreamEvent::Done {
                stop_reason: StopReason::Stop,
                usage: None,
            }),
        ])))
    }
}

fn stored(session_id: Uuid, parent_id: Option<Uuid>, body: Message) -> StoredMessage {
    let now = DateTime::from_timestamp_millis(NEXT_MILLIS.fetch_add(1, Ordering::Relaxed))
        .unwrap_or_default();
    StoredMessage {
        id: Uuid::new_v4(),
        session_id,
        parent_id,
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

fn call(id: &str) -> ContentBlock {
    ContentBlock::ToolCall(ToolCall {
        id: id.to_owned(),
        name: "read_file".to_owned(),
        arguments: json!({ "path": "notes.txt" }),
        started_at: None,
        finished_at: None,
    })
}

#[tokio::test]
async fn no_tool_model_receives_no_tools_or_tool_history() -> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let (sessions, session_id) = new_session(&db).await?;
    let root = stored(
        session_id,
        None,
        Message::User {
            content: vec![ContentBlock::Text(TextContent {
                text: "old question".to_owned(),
            })],
        },
    );
    let mixed = stored(
        session_id,
        Some(root.id),
        Message::Assistant {
            content: vec![
                ContentBlock::Text(TextContent {
                    text: "kept text".to_owned(),
                }),
                call("c1"),
            ],
            stop_reason: StopReason::ToolUse,
            usage: None,
        },
    );
    let result = stored(
        session_id,
        Some(mixed.id),
        Message::ToolResult {
            tool_call_id: "c1".to_owned(),
            tool_name: "read_file".to_owned(),
            content: vec![ContentBlock::Text(TextContent {
                text: "old result".to_owned(),
            })],
            is_error: false,
        },
    );
    let calls_only = stored(
        session_id,
        Some(result.id),
        Message::Assistant {
            content: vec![
                ContentBlock::Thinking(ThinkingContent {
                    thinking: "choose a tool".to_owned(),
                    signature: None,
                    started_at: None,
                    finished_at: None,
                }),
                call("c2"),
            ],
            stop_reason: StopReason::ToolUse,
            usage: None,
        },
    );
    let last_result = stored(
        session_id,
        Some(calls_only.id),
        Message::ToolResult {
            tool_call_id: "c2".to_owned(),
            tool_name: "read_file".to_owned(),
            content: Vec::new(),
            is_error: false,
        },
    );
    for message in [&root, &mixed, &result, &calls_only, &last_result] {
        sessions.append_message(message.clone()).await?;
    }
    sessions.update_leaf(session_id, last_result.id).await?;
    let recorded = Arc::new(Mutex::new(None));
    let mut registry = ToolRegistry::new();
    registry.register(ReadFileTool);
    let env = LocalExecEnv::open(&env::temp_dir(), CancelToken::new()).await?;
    let runtime = ToolRuntime::new(registry, env);
    let agent_loop = AgentLoop::new(
        sessions.clone(),
        RecordingAdapter(Arc::clone(&recorded)),
        Some(runtime),
    );
    let turn = input(session_id);
    let turn = lemma_agent_loop::TurnInput {
        parent_id: Some(last_result.id),
        tool_calling: false,
        ..turn
    };
    agent_loop
        .run_turn(turn, &|_| {}, &CancelToken::new())
        .await?;

    let recorded = recorded
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .take()
        .ok_or("request not recorded")?;
    assert_eq!(recorded.tools, 0, "no tool specs");
    assert_eq!(recorded.messages.len(), 3, "tool messages stripped");
    assert_eq!(recorded.messages[0].visible_text(), "old question");
    assert_eq!(recorded.messages[1].visible_text(), "kept text");
    assert_eq!(
        recorded.messages[1].tool_calls().count(),
        0,
        "call stripped"
    );
    assert_eq!(recorded.messages[2].visible_text(), "hello", "new user");
    let stored = sessions.all_messages(session_id).await?;
    assert_eq!(stored.len(), 7, "stored history remains unchanged");
    assert_eq!(
        stored[1].body.0.tool_calls().count(),
        1,
        "stored call remains"
    );
    assert_eq!(
        stored[3].body.0.tool_calls().count(),
        1,
        "empty projection remains stored"
    );
    assert_eq!(
        stored[6].api_format,
        Some(lemma_model::ApiFormat::OpenAiCompatible)
    );
    Ok(())
}
