use std::sync::Arc;

use lemma_core::{Message, StopReason};
use lemma_model::{Adapter, ModelRequest};
use lemma_session::{LastModel, StoredMessage, TraceStore, build_context_path};
use uuid::Uuid;

use crate::error::LoopError;
use crate::event::{TurnEvent, TurnObserver};
use crate::persist::{now_ms, placeholder, settle, settled, tool_result};
use crate::stream::run_stream;
use crate::tool::ToolRuntime;

/// Model selection of one turn.
#[derive(Debug, Clone)]
pub struct AgentConfig {
    /// Target model identifier.
    pub model: String,
    /// Provider row the turn is dispatched to.
    pub provider_id: Uuid,
    /// Reasoning effort level, when the model exposes one.
    pub thinking_effort: Option<String>,
}

/// One user message and where it goes.
pub struct TurnInput {
    /// Conversation the turn continues from its active leaf.
    pub conversation_id: Uuid,
    /// Id the user message is stored under.
    pub user_message_id: Uuid,
    /// The user message.
    pub user_message: Message,
    /// Model selection.
    pub config: AgentConfig,
}

/// Runs turns: assembles each step's context from the session tree, streams
/// the model through its adapter, executes requested tool calls, and
/// persists every message as it settles.
pub struct AgentLoop {
    store: Arc<dyn TraceStore>,
    adapter: Arc<dyn Adapter>,
    tools: Option<ToolRuntime>,
}

impl AgentLoop {
    /// Creates a loop that calls the model without tools.
    pub fn new(store: Arc<dyn TraceStore>, adapter: Arc<dyn Adapter>) -> Self {
        Self {
            store,
            adapter,
            tools: None,
        }
    }

    /// Attaches tool execution wiring to the loop.
    pub fn with_tools(mut self, runtime: ToolRuntime) -> Self {
        self.tools = Some(runtime);
        self
    }

    /// Appends the user message under the active leaf and runs steps until
    /// one requests no tools or a stream fails.
    pub async fn run_turn(
        &self,
        input: TurnInput,
        observer: TurnObserver<'_>,
    ) -> Result<(), LoopError> {
        let TurnInput {
            conversation_id,
            user_message_id,
            user_message,
            config,
        } = input;
        let Some(meta) = self.store.get_conversation(conversation_id).await? else {
            return Err(LoopError::NotFound(format!(
                "conversation {conversation_id} not found"
            )));
        };

        let user_entry = settled(user_message_id, conversation_id, meta.leaf_id, user_message);
        self.append(user_entry).await?;
        observer(TurnEvent::UserAppended {
            id: user_message_id,
        });

        self.store
            .update_conversation_model(
                conversation_id,
                LastModel {
                    provider_id: config.provider_id,
                    model: config.model.clone(),
                    thinking_effort: config.thinking_effort.clone(),
                },
            )
            .await?;

        let tool_specs = self
            .tools
            .as_ref()
            .map(|runtime| runtime.registry.specs())
            .unwrap_or_default();

        let mut leaf_id = user_message_id;
        loop {
            let entries = self.store.list_messages(conversation_id).await?;
            let messages = build_context_path(&entries, leaf_id)?;

            let assistant_id = Uuid::new_v4();
            let started_at = now_ms();
            self.append(placeholder(
                assistant_id,
                conversation_id,
                leaf_id,
                &config.model,
                config.provider_id,
                started_at,
            ))
            .await?;
            observer(TurnEvent::AssistantStarted { id: assistant_id });

            let req = ModelRequest {
                model: config.model.clone(),
                messages,
                tools: tool_specs.clone(),
                thinking_effort: config.thinking_effort.clone(),
            };
            let outcome = run_stream(self.adapter.as_ref(), req, started_at, observer).await;
            self.store
                .update_message(assistant_id, settle(&outcome))
                .await?;

            if let Some(message) = outcome.error.clone() {
                return Err(LoopError::Model(message));
            }

            let tool_calls = outcome.tool_calls();
            let runtime = match self.tools.as_ref() {
                Some(runtime)
                    if outcome.stop_reason == StopReason::ToolUse && !tool_calls.is_empty() =>
                {
                    runtime
                }
                _ => {
                    observer(TurnEvent::AssistantDone {
                        id: assistant_id,
                        full_text: outcome.full_text(),
                        usage: outcome.usage,
                    });
                    return Ok(());
                }
            };

            leaf_id = assistant_id;
            for call in &tool_calls {
                observer(TurnEvent::ToolStarted {
                    id: call.id.clone(),
                    name: call.name.clone(),
                    arguments: serde_json::to_string(&call.arguments).unwrap_or_default(),
                });
                let (text, is_error) = runtime.run(call).await;
                observer(TurnEvent::ToolFinished {
                    id: call.id.clone(),
                    name: call.name.clone(),
                    content: text.clone(),
                    is_error,
                });
                let result_id = Uuid::new_v4();
                self.append(settled(
                    result_id,
                    conversation_id,
                    Some(leaf_id),
                    tool_result(call, text, is_error),
                ))
                .await?;
                leaf_id = result_id;
            }
        }
    }

    async fn append(&self, entry: StoredMessage) -> Result<(), LoopError> {
        let (conversation_id, id) = (entry.conversation_id, entry.id);
        self.store.append_message(entry).await?;
        self.store.update_leaf(conversation_id, id).await?;
        Ok(())
    }
}
