//! Branching with `parent_id` and sanitizing unanswered tool calls in
//! model history.

mod common;

use std::error::Error;
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::{Arc, Mutex, PoisonError};

use chrono::DateTime;
use futures::stream;
use lemma_agent_loop::{AgentLoop, TurnEvent, TurnInput};
use lemma_core::{
    ContentBlock, Message, StopReason, StreamEvent, TextContent, ThinkingContent, ToolCall,
};
use lemma_model::{Adapter, BoxEventStream, ModelError, ModelRequest};
use lemma_session::{Message as StoredMessage, MessageBody, MessageStatus};
use lemma_tool::{CancelToken, LocalExecEnv};
use serde_json::json;
use uuid::Uuid;

use crate::common::{input, new_session};

static NEXT_MILLIS: AtomicI64 = AtomicI64::new(1_710_000_000_000);

struct RecordingAdapter(Arc<Mutex<Vec<Vec<Message>>>>);

impl Adapter for RecordingAdapter {
    async fn stream(&self, req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        self.0
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .push(req.messages);
        Ok(Box::pin(stream::iter([
            Ok(StreamEvent::TextDelta {
                delta: "reply".to_owned(),
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

fn text(text: &str) -> ContentBlock {
    ContentBlock::Text(TextContent {
        text: text.to_owned(),
    })
}

#[tokio::test]
async fn branching_by_parent_id_selects_the_branch_history_and_emits_parents()
-> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let (sessions, session_id) = new_session(&db).await?;
    let recorded = Arc::new(Mutex::new(Vec::new()));
    let agent_loop: AgentLoop<_, LocalExecEnv> = AgentLoop::new(
        sessions.clone(),
        RecordingAdapter(Arc::clone(&recorded)),
        None,
    );

    let first_events = Mutex::new(Vec::new());
    let mut first = input(session_id);
    first.user_message = Message::User {
        content: vec![text("root one")],
    };
    agent_loop
        .run_turn(
            first,
            &|ev| {
                first_events
                    .lock()
                    .unwrap_or_else(PoisonError::into_inner)
                    .push(ev);
            },
            &CancelToken::new(),
        )
        .await?;

    let first_messages = sessions.all_messages(session_id).await?;
    let root_user_id = first_messages[0].id;
    let first_assistant_id = first_messages[1].id;

    let first_events = first_events
        .into_inner()
        .unwrap_or_else(PoisonError::into_inner);
    assert!(
        matches!(
            first_events.first(),
            Some(TurnEvent::UserAppended {
                id,
                parent_id: None,
                ..
            }) if *id == root_user_id
        ),
        "root UserAppended has None parent: {first_events:?}"
    );
    assert!(
        matches!(
            first_events.get(1),
            Some(TurnEvent::AssistantStarted {
                id,
                parent_id,
                ..
            }) if *id == first_assistant_id && *parent_id == root_user_id
        ),
        "AssistantStarted carries user parent: {first_events:?}"
    );

    let sibling = stored(
        session_id,
        Some(first_assistant_id),
        Message::User {
            content: vec![text("sibling user")],
        },
    );
    sessions.append_message(sibling).await?;

    let branch_events = Mutex::new(Vec::new());
    let mut branch = TurnInput {
        parent_id: Some(first_assistant_id),
        ..input(session_id)
    };
    branch.user_message = Message::User {
        content: vec![text("branched question")],
    };
    let branch_user_id = branch.user_message_id;
    agent_loop
        .run_turn(
            branch,
            &|ev| {
                branch_events
                    .lock()
                    .unwrap_or_else(PoisonError::into_inner)
                    .push(ev);
            },
            &CancelToken::new(),
        )
        .await?;

    let mut fresh_root = input(session_id);
    fresh_root.user_message = Message::User {
        content: vec![text("fresh root")],
    };
    agent_loop
        .run_turn(fresh_root, &|_| {}, &CancelToken::new())
        .await?;

    let requests = recorded.lock().unwrap_or_else(PoisonError::into_inner);
    assert_eq!(requests.len(), 3, "three turns recorded");
    assert_eq!(
        requests[1]
            .iter()
            .map(Message::visible_text)
            .collect::<Vec<_>>(),
        ["root one", "reply", "branched question"],
        "branched turn excludes sibling user message"
    );
    assert_eq!(
        requests[2]
            .iter()
            .map(Message::visible_text)
            .collect::<Vec<_>>(),
        ["fresh root"],
        "root branch sees no earlier history"
    );

    let branch_events = branch_events
        .into_inner()
        .unwrap_or_else(PoisonError::into_inner);
    assert!(
        matches!(
            branch_events.first(),
            Some(TurnEvent::UserAppended {
                id,
                parent_id: Some(parent),
                ..
            }) if *id == branch_user_id && *parent == first_assistant_id
        ),
        "branched UserAppended carries parent_id: {branch_events:?}"
    );
    Ok(())
}

#[tokio::test]
async fn unanswered_tool_calls_and_empty_assistant_nodes_are_sanitized_with_tool_calling()
-> Result<(), Box<dyn Error>> {
    let db = lemma_db::in_memory().await?;
    let (sessions, session_id) = new_session(&db).await?;

    let user = stored(
        session_id,
        None,
        Message::User {
            content: vec![text("start")],
        },
    );
    let answered_assistant = stored(
        session_id,
        Some(user.id),
        Message::Assistant {
            content: vec![call("a1"), call("u_partial")],
            stop_reason: StopReason::ToolUse,
            usage: None,
        },
    );
    let tool_result = stored(
        session_id,
        Some(answered_assistant.id),
        Message::ToolResult {
            tool_call_id: "a1".to_owned(),
            tool_name: "read_file".to_owned(),
            content: vec![text("ok")],
            is_error: false,
        },
    );
    let text_plus_unanswered = stored(
        session_id,
        Some(tool_result.id),
        Message::Assistant {
            content: vec![text("partial text"), call("u_text")],
            stop_reason: StopReason::ToolUse,
            usage: None,
        },
    );
    let thinking_plus_unanswered = stored(
        session_id,
        Some(text_plus_unanswered.id),
        Message::Assistant {
            content: vec![
                ContentBlock::Thinking(ThinkingContent {
                    thinking: "some reasoning".to_owned(),
                    signature: None,
                    started_at: None,
                    finished_at: None,
                }),
                call("u_thinking"),
            ],
            stop_reason: StopReason::ToolUse,
            usage: None,
        },
    );
    let empty_and_unanswered = stored(
        session_id,
        Some(thinking_plus_unanswered.id),
        Message::Assistant {
            content: vec![text(""), call("u_only")],
            stop_reason: StopReason::Aborted,
            usage: None,
        },
    );
    let empty_placeholder = stored(
        session_id,
        Some(empty_and_unanswered.id),
        Message::Assistant {
            content: vec![text("")],
            stop_reason: StopReason::Aborted,
            usage: None,
        },
    );
    for entry in [
        &user,
        &answered_assistant,
        &tool_result,
        &text_plus_unanswered,
        &thinking_plus_unanswered,
        &empty_and_unanswered,
        &empty_placeholder,
    ] {
        sessions.append_message(entry.clone()).await?;
    }

    let recorded = Arc::new(Mutex::new(Vec::new()));
    let agent_loop: AgentLoop<_, LocalExecEnv> =
        AgentLoop::new(sessions, RecordingAdapter(Arc::clone(&recorded)), None);
    let turn = TurnInput {
        parent_id: Some(empty_placeholder.id),
        tool_calling: true,
        ..input(session_id)
    };
    agent_loop
        .run_turn(turn, &|_| {}, &CancelToken::new())
        .await?;

    let requests = recorded.lock().unwrap_or_else(PoisonError::into_inner);
    let sent = &requests[0];
    assert_eq!(sent.len(), 6, "empty assistant nodes dropped: {sent:?}");
    assert_eq!(
        sent[1]
            .tool_calls()
            .map(|c| c.id.as_str())
            .collect::<Vec<_>>(),
        ["a1"],
        "unanswered u_partial stripped while answered a1 kept"
    );
    assert!(
        matches!(&sent[2], Message::ToolResult { tool_call_id, .. } if tool_call_id == "a1"),
        "tool result preserved"
    );
    assert_eq!(sent[3].visible_text(), "partial text", "text kept");
    assert_eq!(
        sent[3].tool_calls().count(),
        0,
        "unanswered u_text stripped"
    );
    assert_eq!(
        sent[4].content().len(),
        1,
        "thinking kept and u_thinking stripped"
    );
    assert!(
        matches!(&sent[4].content()[0], ContentBlock::Thinking(t) if t.thinking == "some reasoning"),
        "thinking content intact"
    );
    assert_eq!(sent[5].visible_text(), "hello", "new user message");
    Ok(())
}
