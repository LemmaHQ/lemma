//! Model stream events folded into the persisted assistant message.

mod common;

use std::error::Error;

use futures::stream;
use lemma_agent_loop::{AgentLoop, CancelToken, LoopError};
use lemma_core::{ContentBlock, StopReason, StreamEvent, TextContent, ToolCall};
use lemma_model::{Adapter, BoxEventStream, ModelError, ModelRequest};
use lemma_session::{Message as StoredMessage, MessageStatus};
use lemma_test_db::on_each_database;
use lemma_tool::LocalExecEnv;
use sea_orm::DatabaseConnection;
use serde_json::json;

use crate::common::{Migrator, input, new_session};

/// Replays one scripted stream; an `Err` item fails it at that point.
struct Scripted(Vec<Result<StreamEvent, String>>);

impl Adapter for Scripted {
    async fn stream(&self, _req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        let events: Vec<_> = self
            .0
            .iter()
            .cloned()
            .map(|event| event.map_err(ModelError::new))
            .collect();
        Ok(Box::pin(stream::iter(events)))
    }
}

async fn answer(
    db: &DatabaseConnection,
    events: Vec<Result<StreamEvent, String>>,
) -> Result<(Result<(), LoopError>, StoredMessage), Box<dyn Error>> {
    let (sessions, user_id, session_id) = new_session(db).await?;
    let agent_loop: AgentLoop<_, LocalExecEnv> =
        AgentLoop::new(sessions.clone(), Scripted(events), None);

    let turn = agent_loop
        .run_turn(input(user_id, session_id), &|_| {}, &CancelToken::new())
        .await;

    let answer = sessions
        .all_messages(session_id)
        .await?
        .pop()
        .ok_or("the session has no messages")?;
    Ok((turn, answer))
}

fn text(text: &str) -> ContentBlock {
    ContentBlock::Text(TextContent {
        text: text.to_owned(),
    })
}

#[tokio::test]
async fn a_tool_call_streamed_from_start_to_end_is_stored_once() -> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let call = ToolCall {
            id: "call-1".into(),
            name: "read_file".into(),
            arguments: json!({ "path": "notes.txt" }),
            started_at: None,
            finished_at: None,
        };
        let events = vec![
            Ok(StreamEvent::ToolCallStart {
                id: "call-1".into(),
                name: "read_file".into(),
            }),
            Ok(StreamEvent::ToolCallDelta {
                delta: "{\"path\":".into(),
            }),
            Ok(StreamEvent::ToolCallDelta {
                delta: "\"notes.txt\"}".into(),
            }),
            Ok(StreamEvent::ToolCallEnd { call: call.clone() }),
            Ok(StreamEvent::Done {
                stop_reason: StopReason::ToolUse,
                usage: None,
            }),
        ];

        let (turn, answer) = answer(&db, events).await?;

        turn?;
        assert_eq!(
            answer.body.0.content(),
            [ContentBlock::ToolCall(call)],
            "one block for the streamed call"
        );
        Ok(())
    })
    .await
}

#[tokio::test]
async fn a_fragment_outside_an_open_tool_call_leaves_the_text_intact() -> Result<(), Box<dyn Error>>
{
    on_each_database::<Migrator, _, _>(|db| async move {
        let events = vec![
            Ok(StreamEvent::TextDelta { delta: "Hi".into() }),
            Ok(StreamEvent::ToolCallDelta {
                delta: "{\"path\":".into(),
            }),
            Ok(StreamEvent::TextDelta {
                delta: " there".into(),
            }),
            Ok(StreamEvent::Done {
                stop_reason: StopReason::Stop,
                usage: None,
            }),
        ];

        let (turn, answer) = answer(&db, events).await?;

        turn?;
        assert_eq!(answer.body.0.content(), [text("Hi there")], "content");
        Ok(())
    })
    .await
}

#[tokio::test]
async fn a_stream_failing_midway_keeps_the_partial_answer_as_an_error() -> Result<(), Box<dyn Error>>
{
    on_each_database::<Migrator, _, _>(|db| async move {
        let events = vec![
            Ok(StreamEvent::TextDelta { delta: "Hi".into() }),
            Err("connection reset".to_owned()),
        ];

        let (turn, answer) = answer(&db, events).await?;

        assert!(
            matches!(&turn, Err(LoopError::Model(message)) if message == "connection reset"),
            "{turn:?}"
        );
        assert_eq!(answer.status, MessageStatus::Error, "status");
        assert_eq!(answer.error.as_deref(), Some("connection reset"), "error");
        assert_eq!(answer.body.0.content(), [text("Hi")], "partial answer");
        Ok(())
    })
    .await
}
