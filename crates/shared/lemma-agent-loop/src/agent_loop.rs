use chrono::Utc;
use lemma_conversation::{ConversationService, LastModel, Message as StoredMessage};
use lemma_core::{ContentBlock, Message, StopReason};
use lemma_model::{Adapter, ModelRequest};
use lemma_tools::ExecEnv;
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
    /// Authenticated caller conversation queries are scoped to.
    pub user_id: Uuid,
    /// Conversation the turn continues from its active leaf.
    pub conversation_id: Uuid,
    /// Id the user message is stored under.
    pub user_message_id: Uuid,
    /// The user message.
    pub user_message: Message,
    /// Model selection, also recorded as the conversation's last model.
    pub model: LastModel,
}

/// How a turn ended without failing.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TurnEnd {
    /// A step ended without requesting tools.
    Done,
    /// The turn's cancel token fired.
    Aborted,
}

/// Runs turns: assembles each step's context from the message tree, streams
/// the model through its adapter, executes requested tool calls in an `E`
/// environment, and persists every message as it settles.
#[derive(Debug)]
pub struct AgentLoop<A, E> {
    conversations: ConversationService,
    adapter: A,
    tools: Option<ToolRuntime<E>>,
}

impl<A: Adapter, E: ExecEnv> AgentLoop<A, E> {
    /// Creates a loop that calls the model without tools.
    pub fn new(conversations: ConversationService, adapter: A) -> Self {
        Self {
            conversations,
            adapter,
            tools: None,
        }
    }

    /// Attaches tool execution wiring to the loop.
    #[must_use]
    pub fn with_tools(mut self, runtime: ToolRuntime<E>) -> Self {
        self.tools = Some(runtime);
        self
    }

    /// Appends the user message under the active leaf and runs steps until
    /// one requests no tools, a stream fails, or `cancel` fires. Cancelling
    /// interrupts a model stream and stops before the next step; a running
    /// tool call completes first.
    ///
    /// # Errors
    ///
    /// [`LoopError::NotFound`] when the user owns no such conversation or a
    /// message on the context path is missing, [`LoopError::Model`] when a
    /// model stream fails, and [`LoopError::Store`] when the database fails.
    pub async fn run_turn<O: Fn(TurnEvent) + Sync>(
        &self,
        input: TurnInput,
        observer: &O,
        cancel: &CancelToken,
    ) -> Result<TurnEnd, LoopError> {
        let TurnInput {
            user_id,
            conversation_id,
            user_message_id,
            user_message,
            model,
        } = input;
        let Some(meta) = self.conversations.find(user_id, conversation_id).await? else {
            return Err(LoopError::NotFound(format!(
                "conversation {conversation_id} not found"
            )));
        };

        let user_entry =
            persist::settled(user_message_id, conversation_id, meta.leaf_id, user_message);
        self.append(user_id, user_entry).await?;
        observer(TurnEvent::UserAppended {
            id: user_message_id,
        });

        self.conversations
            .update_last_model(user_id, conversation_id, &model)
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
                return Ok(TurnEnd::Aborted);
            }
            let entries = self.conversations.all_messages(conversation_id).await?;
            let messages = lemma_conversation::build_context_path(&entries, leaf_id)?;

            let assistant_id = Uuid::new_v4();
            let placeholder = persist::placeholder(
                assistant_id,
                conversation_id,
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
                thinking_effort: model.thinking_effort.clone(),
            };
            let mut outcome = stream::run_stream(&self.adapter, req, observer, cancel).await;
            self.conversations
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
                    return Ok(TurnEnd::Aborted);
                }
            }

            let has_tool_calls = outcome
                .blocks
                .iter()
                .any(|block| matches!(block, ContentBlock::ToolCall(_)));
            let runtime = match self.tools.as_ref() {
                Some(runtime) if outcome.stop_reason == StopReason::ToolUse && has_tool_calls => {
                    runtime
                }
                _ => {
                    if outcome.stop_reason == StopReason::ToolUse {
                        outcome.finish_thinking(outcome.ended_at);
                        self.conversations
                            .update_message(assistant_id, persist::settle(&outcome))
                            .await?;
                    }
                    observer(TurnEvent::AssistantDone {
                        id: assistant_id,
                        usage: outcome.usage,
                        at: outcome.ended_at,
                    });
                    return Ok(TurnEnd::Done);
                }
            };

            leaf_id = assistant_id;
            let mut results = Vec::new();
            let mut thinking_finished_at = None;
            for block in &mut outcome.blocks {
                let ContentBlock::ToolCall(call) = block else {
                    continue;
                };
                let started_at = Utc::now();
                thinking_finished_at.get_or_insert(started_at);
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
                    name: call.name.clone(),
                    content: tool_outcome.text.clone(),
                    is_error: tool_outcome.is_error,
                    at: finished_at,
                });
                results.push(persist::tool_result(call, tool_outcome));
            }
            if let Some(at) = thinking_finished_at {
                outcome.finish_thinking(at);
            }
            self.conversations
                .update_message(assistant_id, persist::settle(&outcome))
                .await?;
            for result in results {
                let result_id = Uuid::new_v4();
                let result = persist::settled(result_id, conversation_id, Some(leaf_id), result);
                self.append(user_id, result).await?;
                leaf_id = result_id;
            }
        }
    }

    async fn append(&self, user_id: Uuid, entry: StoredMessage) -> Result<(), LoopError> {
        let (conversation_id, id) = (entry.conversation_id, entry.id);
        self.conversations.append_message(entry).await?;
        self.conversations
            .update_leaf(user_id, conversation_id, id)
            .await?;
        Ok(())
    }
}
