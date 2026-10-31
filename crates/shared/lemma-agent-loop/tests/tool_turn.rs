//! A turn whose first model step calls a tool.

mod common;

use std::env;
use std::error::Error;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use futures::stream;
use lemma_agent_loop::{AgentLoop, CancelToken, ToolRuntime};
use lemma_conversation::MessageStatus;
use lemma_core::{ContentBlock, Message, StopReason, StreamEvent, ToolCall};
use lemma_model::{Adapter, BoxEventStream, ModelError, ModelRequest};
use lemma_test_db::on_each_database;
use lemma_tools::{LocalExecEnv, ToolRegistry};
use serde_json::json;

use crate::common::{Migrator, input, new_conversation};

/// Calls a tool on its first step and answers in text on the next, noting
/// how many messages that second request carried.
struct ToolThenText {
    steps: AtomicUsize,
    second_context: Arc<AtomicUsize>,
}

impl Adapter for ToolThenText {
    async fn stream(&self, req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        let events = if self.steps.fetch_add(1, Ordering::SeqCst) == 0 {
            vec![
                Ok(StreamEvent::ThinkingDelta {
                    delta: "choose a tool".into(),
                }),
                Ok(StreamEvent::ToolCallEnd {
                    call: ToolCall {
                        id: "call-1".into(),
                        name: "missing_tool".into(),
                        arguments: json!({}),
                        started_at: None,
                        finished_at: None,
                    },
                }),
                Ok(StreamEvent::Done {
                    stop_reason: StopReason::ToolUse,
                    usage: None,
                }),
            ]
        } else {
            self.second_context
                .store(req.messages.len(), Ordering::SeqCst);
            vec![
                Ok(StreamEvent::ThinkingDelta {
                    delta: "answer now".into(),
                }),
                Ok(StreamEvent::TextDelta {
                    delta: "all done".into(),
                }),
                Ok(StreamEvent::Done {
                    stop_reason: StopReason::Stop,
                    usage: None,
                }),
            ]
        };
        Ok(Box::pin(stream::iter(events)))
    }
}

#[tokio::test]
async fn a_tool_call_extends_one_branch_and_moves_the_leaf_to_the_final_answer()
-> Result<(), Box<dyn Error>> {
    on_each_database::<Migrator, _, _>(|db| async move {
        let (conversations, user_id, conversation_id) = new_conversation(&db).await?;
        let second_context = Arc::new(AtomicUsize::new(0));
        let adapter = ToolThenText {
            steps: AtomicUsize::new(0),
            second_context: Arc::clone(&second_context),
        };
        let runtime = ToolRuntime::new(ToolRegistry::new(), LocalExecEnv::new(env::temp_dir()));
        let agent_loop = AgentLoop::new(conversations.clone(), adapter).with_tools(runtime);

        agent_loop
            .run_turn(
                input(user_id, conversation_id),
                &|_| {},
                &CancelToken::new(),
            )
            .await?;

        let messages = conversations.all_messages(conversation_id).await?;
        let roles: Vec<&str> = messages.iter().map(|m| m.role()).collect();
        assert_eq!(
            roles,
            ["user", "assistant", "tool", "assistant"],
            "roles in order"
        );
        let parents: Vec<_> = messages.iter().map(|m| m.parent_id).collect();
        assert_eq!(
            parents,
            [
                None,
                Some(messages[0].id),
                Some(messages[1].id),
                Some(messages[2].id)
            ],
            "each message continues the previous one"
        );
        assert!(
            messages.iter().all(|m| m.status == MessageStatus::Done),
            "statuses: {messages:?}"
        );
        let Some(call) = messages[1].body.0.tool_calls().next() else {
            return Err("assistant message has no tool call".into());
        };
        let (Some(tool_started), Some(tool_finished)) = (call.started_at, call.finished_at) else {
            return Err("tool call has no persisted timing".into());
        };
        assert!(
            tool_started <= tool_finished,
            "tool finish follows its start"
        );
        for index in [1, 3] {
            let thinking = messages[index]
                .body
                .0
                .content()
                .iter()
                .find_map(|block| match block {
                    ContentBlock::Thinking(thinking) => Some(thinking),
                    _ => None,
                });
            let Some(thinking) = thinking else {
                return Err(format!("message {index} has no thinking block").into());
            };
            let (Some(started), Some(finished)) = (thinking.started_at, thinking.finished_at)
            else {
                return Err(format!("message {index} has no thinking timing").into());
            };
            assert!(started <= finished, "thinking finish follows its start");
        }
        let Message::ToolResult {
            tool_call_id,
            is_error,
            ..
        } = &messages[2].body.0
        else {
            return Err(format!("not a tool result: {:?}", messages[2].body).into());
        };
        assert_eq!(tool_call_id, "call-1", "the result answers the call");
        assert!(is_error, "an unknown tool reports an error");
        assert_eq!(
            messages[3].body.0.visible_text(),
            "all done",
            "final answer"
        );
        assert_eq!(
            second_context.load(Ordering::SeqCst),
            3,
            "the second step sees the user message, the call, and its result"
        );
        let conversation = conversations.find(user_id, conversation_id).await?;
        assert_eq!(
            conversation.and_then(|c| c.leaf_id),
            Some(messages[3].id),
            "leaf"
        );
        Ok(())
    })
    .await
}
