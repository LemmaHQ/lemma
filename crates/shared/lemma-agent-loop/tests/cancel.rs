//! Turn cancellation through `CancelToken`.

mod common;

use std::error::Error;

use futures::{FutureExt, stream};
use lemma_agent_loop::{AgentLoop, TurnEvent};
use lemma_core::{ContentBlock, Message, StopReason, StreamEvent, TextContent};
use lemma_model::{Adapter, BoxEventStream, ModelError, ModelRequest};
use lemma_session::{MessageBody, MessageStatus};
use lemma_tool::{CancelToken, LocalExecEnv};
use tokio::sync::mpsc;

use crate::common::{input, new_session};

/// Streams one text delta, then waits forever for more.
struct StalledAdapter;

impl Adapter for StalledAdapter {
    async fn stream(&self, _req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        use futures::StreamExt;

        let head = stream::iter([Ok(StreamEvent::TextDelta {
            delta: "partial".into(),
        })]);
        Ok(Box::pin(head.chain(stream::pending())))
    }
}

#[tokio::test]
async fn cancel_mid_stream_settles_placeholder_as_aborted() -> Result<(), Box<dyn Error>> {
    let db = lemma_test_db::database().await?;
    let (sessions, session_id) = new_session(&db).await?;
    let agent_loop: AgentLoop<_, LocalExecEnv> =
        AgentLoop::new(sessions.clone(), StalledAdapter, None);
    let cancel = CancelToken::new();
    let (tx, mut rx) = mpsc::unbounded_channel();
    let observer = move |ev: TurnEvent| {
        let _ = tx.send(ev);
    };

    let run = agent_loop.run_turn(input(session_id), &observer, &cancel);
    let watch = async {
        while let Some(ev) = rx.recv().await {
            if matches!(ev, TurnEvent::Delta { .. }) {
                cancel.cancel();
            }
        }
    };
    tokio::select! {
        end = run => end?,
        () = watch => return Err("observer closed before the turn ended".into()),
    }

    let messages = sessions.all_messages(session_id).await?;
    assert_eq!(messages.len(), 2, "user message and assistant placeholder");
    let assistant = &messages[1];
    assert_eq!(
        assistant.status,
        MessageStatus::Aborted,
        "placeholder status"
    );
    assert_eq!(
        assistant.body,
        MessageBody(Message::Assistant {
            content: vec![ContentBlock::Text(TextContent {
                text: "partial".into()
            })],
            stop_reason: StopReason::Aborted,
            usage: None,
        }),
        "settled body keeps the streamed text"
    );
    let session = sessions.find(session_id).await?;
    assert_eq!(session.and_then(|c| c.leaf_id), Some(assistant.id), "leaf");
    Ok(())
}

#[tokio::test]
async fn cancel_before_run_appends_only_the_user_message() -> Result<(), Box<dyn Error>> {
    let db = lemma_test_db::database().await?;
    let (sessions, session_id) = new_session(&db).await?;
    let agent_loop: AgentLoop<_, LocalExecEnv> =
        AgentLoop::new(sessions.clone(), StalledAdapter, None);
    let cancel = CancelToken::new();
    cancel.cancel();

    let turn = input(session_id);
    let user_message_id = turn.user_message_id;
    agent_loop.run_turn(turn, &|_| {}, &cancel).await?;

    let messages = sessions.all_messages(session_id).await?;
    assert_eq!(messages.len(), 1, "only the user message");
    assert_eq!(messages[0].id, user_message_id, "user message id");
    let session = sessions.find(session_id).await?;
    assert_eq!(
        session.and_then(|c| c.leaf_id),
        Some(user_message_id),
        "leaf"
    );
    Ok(())
}

#[test]
fn cancelled_completes_at_once_for_a_token_cancelled_earlier() {
    let token = CancelToken::new();
    token.cancel();

    assert_eq!(
        token.cancelled().now_or_never(),
        Some(()),
        "an earlier cancel is already observed"
    );
}
