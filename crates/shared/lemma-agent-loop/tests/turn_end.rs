//! Turns that end without running a tool, or on a store or tree failure.

mod common;

use std::error::Error;
use std::sync::Mutex;

use futures::stream;
use lemma_agent_loop::{AgentLoop, CancelToken, LoopError, TurnEvent};
use lemma_conversation::MessageStatus;
use lemma_core::{ContentBlock, StopReason, StreamEvent, ToolCall};
use lemma_model::{Adapter, BoxEventStream, ModelError, ModelRequest};
use lemma_test_db::on_each_database;
use lemma_tools::LocalExecEnv;
use serde_json::json;
use uuid::Uuid;

use crate::common::{Migrator, input, new_conversation};

/// Thinks, then stops for tool use with one tool call.
struct AsksForTool;

impl Adapter for AsksForTool {
    async fn stream(&self, _req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        Ok(Box::pin(stream::iter([
            Ok(StreamEvent::ThinkingDelta {
                delta: "a tool would help".into(),
            }),
            Ok(StreamEvent::ToolCallEnd {
                call: ToolCall {
                    id: "call-1".into(),
                    name: "read_file".into(),
                    arguments: json!({ "path": "notes.txt" }),
                    started_at: None,
                    finished_at: None,
                },
            }),
            Ok(StreamEvent::Done {
                stop_reason: StopReason::ToolUse,
                usage: None,
            }),
        ])))
    }
}

/// Refuses every request.
struct Refuses;

impl Adapter for Refuses {
    async fn stream(&self, _req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        Err(ModelError::new("HTTP 429: rate limited".to_owned()))
    }
}

#[tokio::test]
async fn a_tool_use_stop_without_tools_ends_the_turn_on_that_step() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let (conversations, user_id, conversation_id) = new_conversation(&db).await?;
        let agent_loop: AgentLoop<_, LocalExecEnv> =
            AgentLoop::new(conversations.clone(), AsksForTool, None);
        let events = Mutex::new(Vec::new());

        agent_loop
            .run_turn(
                input(user_id, conversation_id),
                &|event| events.lock().unwrap_or_else(|e| e.into_inner()).push(event),
                &CancelToken::new(),
            )
            .await?;

        let events = events.into_inner().unwrap_or_else(|e| e.into_inner());
        assert!(
            matches!(events.last(), Some(TurnEvent::AssistantDone { .. })),
            "{events:?}"
        );
        assert!(
            !events
                .iter()
                .any(|event| matches!(event, TurnEvent::ToolStarted { .. })),
            "no tool runs: {events:?}"
        );
        let messages = conversations.all_messages(conversation_id).await?;
        let roles: Vec<&str> = messages.iter().map(|m| m.role()).collect();
        assert_eq!(
            roles,
            ["user", "assistant"],
            "the turn stops after one step"
        );
        let assistant = &messages[1];
        assert_eq!(assistant.status, MessageStatus::Done, "{assistant:?}");
        assert_eq!(
            assistant
                .body
                .0
                .tool_calls()
                .map(|call| &call.id)
                .collect::<Vec<_>>(),
            ["call-1"],
            "the unanswered call is kept"
        );
        let thinking = assistant
            .body
            .0
            .content()
            .iter()
            .find_map(|block| match block {
                ContentBlock::Thinking(thinking) => Some(thinking),
                _ => None,
            })
            .ok_or("no thinking block")?;
        assert!(
            thinking.finished_at.is_some(),
            "the thinking is settled: {thinking:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn a_refused_model_call_ends_the_turn_with_the_model_message() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let (conversations, user_id, conversation_id) = new_conversation(&db).await?;
        let agent_loop: AgentLoop<_, LocalExecEnv> = AgentLoop::new(conversations, Refuses, None);

        let result = agent_loop
            .run_turn(
                input(user_id, conversation_id),
                &|_| {},
                &CancelToken::new(),
            )
            .await;

        assert!(
            matches!(&result, Err(e @ LoopError::Model(_)) if e.to_string().contains("HTTP 429: rate limited")),
            "{result:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn a_closed_database_ends_the_turn_with_a_store_error() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let (conversations, user_id, conversation_id) = new_conversation(&db).await?;
        let agent_loop: AgentLoop<_, LocalExecEnv> =
            AgentLoop::new(conversations, AsksForTool, None);
        db.close().await?;

        let result = agent_loop
            .run_turn(
                input(user_id, conversation_id),
                &|_| {},
                &CancelToken::new(),
            )
            .await;

        assert!(
            matches!(&result, Err(e @ LoopError::Store(cause)) if e.to_string().contains(cause.as_str())),
            "{result:?}"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn a_leaf_missing_from_the_tree_ends_the_turn_as_not_found() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let (conversations, user_id, conversation_id) = new_conversation(&db).await?;
        let missing = Uuid::new_v4();
        conversations
            .update_leaf(user_id, conversation_id, missing)
            .await?;
        let agent_loop: AgentLoop<_, LocalExecEnv> =
            AgentLoop::new(conversations.clone(), AsksForTool, None);

        let result = agent_loop
            .run_turn(
                input(user_id, conversation_id),
                &|_| {},
                &CancelToken::new(),
            )
            .await;

        assert!(
            matches!(&result, Err(LoopError::NotFound(message)) if message.contains(&missing.to_string())),
            "{result:?}"
        );
        let messages = conversations.all_messages(conversation_id).await?;
        assert_eq!(messages.len(), 1, "only the user message: {messages:?}");
        Ok(())
    })
    .await
}
