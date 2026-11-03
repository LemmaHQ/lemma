use chrono::Utc;
use lemma_core::{ContentBlock, Message, StopReason};
use lemma_model::{Adapter, ModelRequest};
use lemma_session::{LastModel, Message as StoredMessage, SessionService};
use lemma_tool::ExecEnv;
use uuid::Uuid;

use crate::cancel_token::CancelToken;
use crate::loop_error::LoopError;
use crate::persist;
use crate::stream::{self, StepEnd};
use crate::tool_runtime::ToolRuntime;
use crate::turn_event::TurnEvent;

/// One user message and where it goes.
#[derive(Debug)]
pub struct TurnInput {
    /// Authenticated caller session queries are scoped to.
    pub user_id: Uuid,
    /// Session the turn continues from its active leaf.
    pub session_id: Uuid,
    /// Id the user message is stored under.
    pub user_message_id: Uuid,
    /// The user message.
    pub user_message: Message,
    /// Model selection, also recorded as the session's last model.
    pub model: LastModel,
}

/// Runs turns: assembles each step's context from the message tree, streams
/// the model through its adapter, executes requested tool calls in an `E`
/// environment, and persists every message as it settles.
#[derive(Debug)]
pub struct AgentLoop<A, E> {
    sessions: SessionService,
    adapter: A,
    tools: Option<ToolRuntime<E>>,
}

impl<A: Adapter, E: ExecEnv> AgentLoop<A, E> {
    /// Creates a loop that runs tool calls with `tools`, or calls the model
    /// without tools when it is `None`.
    pub fn new(sessions: SessionService, adapter: A, tools: Option<ToolRuntime<E>>) -> Self {
        Self {
            sessions,
            adapter,
            tools,
        }
    }

    /// Appends the user message under the active leaf and runs steps until
    /// one requests no tools, a stream fails, or `cancel` fires. Cancelling
    /// interrupts a model stream and stops before the next step; a running
    /// tool call completes first.
    ///
    /// # Errors
    ///
    /// [`LoopError::NotFound`] when the user owns no such session or a
    /// message on the context path is missing, [`LoopError::Model`] when a
    /// model stream fails, and [`LoopError::Store`] when the database fails.
    pub async fn run_turn<O: Fn(TurnEvent) + Sync>(
        &self,
        input: TurnInput,
        observer: &O,
        cancel: &CancelToken,
    ) -> Result<(), LoopError> {
        let TurnInput {
            user_id,
            session_id,
            user_message_id,
            user_message,
            model,
        } = input;
        let Some(meta) = self.sessions.find(user_id, session_id).await? else {
            return Err(LoopError::NotFound(format!(
                "session {session_id} not found"
            )));
        };

        let user_entry = persist::settled(user_message_id, session_id, meta.leaf_id, user_message);
        self.append(user_id, user_entry).await?;
        observer(TurnEvent::UserAppended {
            id: user_message_id,
        });

        self.sessions
            .update_last_model(user_id, session_id, &model)
            .await?;

        let tool_specs = self
            .tools
            .as_ref()
            .map(|runtime| runtime.registry.specs())
            .unwrap_or_default();

        let mut leaf_id = user_message_id;
        loop {
            if cancel.is_cancelled() {
                observer(TurnEvent::TurnAborted { at: Utc::now() });
                return Ok(());
            }
            let entries = self.sessions.all_messages(session_id).await?;
            let messages = lemma_session::build_context_path(&entries, leaf_id)?;

            let assistant_id = Uuid::new_v4();
            let placeholder = persist::placeholder(
                assistant_id,
                session_id,
                leaf_id,
                &model.model,
                model.provider_id,
            );
            self.append(user_id, placeholder).await?;
            observer(TurnEvent::AssistantStarted { id: assistant_id });

            let req = ModelRequest {
                model: model.model.clone(),
                messages,
                tools: tool_specs.clone(),
            };
            let mut outcome = stream::run_stream(&self.adapter, req, observer, cancel).await;
            let calls_tools = outcome.stop_reason == StopReason::ToolUse
                && outcome
                    .blocks
                    .iter()
                    .any(|block| matches!(block, ContentBlock::ToolCall(_)));
            let tool_runtime = if calls_tools {
                self.tools.as_ref()
            } else {
                None
            };
            if tool_runtime.is_none() {
                outcome.finish_thinking(outcome.ended_at);
            }
            self.sessions
                .update_message(assistant_id, persist::settle(&outcome))
                .await?;

            match outcome.end {
                StepEnd::Completed => {}
                StepEnd::Failed(message) => {
                    observer(TurnEvent::TurnFailed {
                        message: message.clone(),
                        at: outcome.ended_at,
                    });
                    return Err(LoopError::Model(message));
                }
                StepEnd::Aborted => {
                    observer(TurnEvent::TurnAborted {
                        at: outcome.ended_at,
                    });
                    return Ok(());
                }
            }

            let Some(runtime) = tool_runtime else {
                observer(TurnEvent::AssistantDone {
                    usage: outcome.usage,
                    at: outcome.ended_at,
                });
                return Ok(());
            };

            leaf_id = assistant_id;
            outcome.finish_thinking(Utc::now());
            let mut results = Vec::new();
            for block in &mut outcome.blocks {
                let ContentBlock::ToolCall(call) = block else {
                    continue;
                };
                let started_at = Utc::now();
                call.started_at = Some(started_at);
                observer(TurnEvent::ToolStarted {
                    id: call.id.clone(),
                    name: call.name.clone(),
                    arguments: serde_json::to_string(&call.arguments).unwrap_or_default(),
                    at: started_at,
                });
                let tool_outcome = runtime.run(call).await;
                let finished_at = Utc::now();
                call.finished_at = Some(finished_at);
                observer(TurnEvent::ToolFinished {
                    id: call.id.clone(),
                    content: tool_outcome.text.clone(),
                    is_error: tool_outcome.is_error,
                    at: finished_at,
                });
                results.push(persist::tool_result(call, tool_outcome));
            }
            self.sessions
                .update_message(assistant_id, persist::settle(&outcome))
                .await?;
            for result in results {
                let result_id = Uuid::new_v4();
                let result = persist::settled(result_id, session_id, Some(leaf_id), result);
                self.append(user_id, result).await?;
                leaf_id = result_id;
            }
        }
    }

    async fn append(&self, user_id: Uuid, entry: StoredMessage) -> Result<(), LoopError> {
        let (session_id, id) = (entry.session_id, entry.id);
        self.sessions.append_message(entry).await?;
        self.sessions.update_leaf(user_id, session_id, id).await?;
        Ok(())
    }
}
