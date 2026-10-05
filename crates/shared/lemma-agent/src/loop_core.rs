use std::sync::Arc;

use futures::StreamExt;
use lemma_adapter::{ChatRequest, Provider, ProviderKind};
use lemma_core::{
    ContentBlock, Message, StopReason, StreamEvent, TextContent, ThinkingContent, ToolCall, Usage,
};
use lemma_session::{
    LastModel, MessageStatus, MessageUpdate, StoredMessage, TraceStore, build_context_path,
};
use uuid::Uuid;

use crate::error::AgentError;

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as i64)
}

/// Events emitted during an observed turn execution.
#[derive(Debug, Clone)]
pub enum TurnEvent {
    /// The user message has been committed to the tree.
    UserAppended {
        /// Message ID.
        id: Uuid,
    },
    /// A text delta received from the provider stream.
    Delta {
        /// Incremental chunk.
        delta: String,
    },
    /// A reasoning delta received from the provider stream.
    ThinkingDelta {
        /// Incremental reasoning chunk.
        delta: String,
    },
    /// The assistant message has been completed and persisted.
    AssistantDone {
        /// Message ID.
        id: Uuid,
        /// Full text content.
        full_text: String,
        /// Token usage if provided.
        usage: Option<Usage>,
    },
}

/// Callback observer for real-time streaming notifications.
pub type BoxTurnObserver = Box<dyn Fn(TurnEvent) + Send + Sync>;

/// The currently open content block while accumulating a stream.
enum OpenBlock {
    Text(String),
    Thinking(String),
    ToolCall {
        id: String,
        name: String,
        arguments: String,
    },
}

impl OpenBlock {
    /// Closes the block into its canonical content form.
    fn close(self, signature: Option<String>) -> ContentBlock {
        match self {
            Self::Text(text) => ContentBlock::Text(TextContent { text }),
            Self::Thinking(thinking) => ContentBlock::Thinking(ThinkingContent {
                thinking,
                signature,
            }),
            Self::ToolCall {
                id,
                name,
                arguments,
            } => ContentBlock::ToolCall(ToolCall {
                id,
                name,
                arguments: serde_json::from_str(&arguments)
                    .unwrap_or(serde_json::Value::String(arguments)),
            }),
        }
    }
}

/// Runtime parameters passed to an agent step execution.
#[derive(Clone)]
pub struct AgentConfig {
    /// Provider kind selecting the protocol adapter.
    pub kind: ProviderKind,
    /// Provider endpoint base URL.
    pub base_url: String,
    /// Custom path override, if any.
    pub api_path: String,
    /// Plaintext API key.
    pub api_key: String,
    /// Target model identifier.
    pub model: String,
    /// Provider row the turn is dispatched to.
    pub provider_id: Uuid,
    /// Reasoning effort level, when the model exposes one.
    pub thinking_effort: Option<String>,
}

/// The core execution engine.
///
/// Drives context assembly from the session tree, dispatches calls to
/// the provider layer, updates the trace tree, and handles branching.
pub struct AgentLoop {
    store: Arc<dyn TraceStore>,
    provider: Arc<dyn Provider>,
}

impl AgentLoop {
    /// Creates a new execution engine.
    pub fn new(store: Arc<dyn TraceStore>, provider: Arc<dyn Provider>) -> Self {
        Self { store, provider }
    }

    /// Appends a user prompt to a conversation, executes the generation step,
    /// and stores the resulting assistant turn without intermediate notifications.
    pub async fn run_turn(
        &self,
        conversation_id: Uuid,
        user_message: Message,
        parent_id_override: Option<Uuid>,
        config: AgentConfig,
    ) -> Result<(Uuid, String), AgentError> {
        self.run_turn_observed(
            conversation_id,
            user_message,
            parent_id_override,
            config,
            None,
        )
        .await
    }

    /// Appends a user prompt to a conversation, executes the generation step,
    /// streams delta events to `observer`, and updates the assistant message in-place.
    pub async fn run_turn_observed(
        &self,
        conversation_id: Uuid,
        user_message: Message,
        parent_id_override: Option<Uuid>,
        config: AgentConfig,
        observer: Option<Arc<dyn Fn(TurnEvent) + Send + Sync>>,
    ) -> Result<(Uuid, String), AgentError> {
        let meta = self
            .store
            .get_conversation(conversation_id)
            .await?
            .ok_or_else(|| {
                AgentError::NotFound(format!("conversation {conversation_id} not found"))
            })?;

        let user_parent_id = parent_id_override.or(meta.leaf_id);

        let user_msg_id = Uuid::new_v4();
        let now = now_ms();
        let user_entry = StoredMessage {
            id: user_msg_id,
            conversation_id,
            parent_id: user_parent_id,
            message: user_message,
            status: MessageStatus::Done,
            error: None,
            model: None,
            provider_id: None,
            started_at: now,
            created_at: now,
        };

        self.store.append_message(user_entry).await?;
        self.store.update_leaf(conversation_id, user_msg_id).await?;

        if let Some(obs) = &observer {
            obs(TurnEvent::UserAppended { id: user_msg_id });
        }

        let all_entries = self.store.list_messages(conversation_id).await?;
        let linear_context = build_context_path(&all_entries, user_msg_id)?;

        let assistant_msg_id = Uuid::new_v4();
        let initial_assistant_msg = Message::Assistant {
            content: vec![ContentBlock::Text(TextContent {
                text: String::new(),
            })],
            stop_reason: StopReason::Stop,
            usage: None,
        };

        let started_at = now_ms();
        let assistant_entry = StoredMessage {
            id: assistant_msg_id,
            conversation_id,
            parent_id: Some(user_msg_id),
            message: initial_assistant_msg,
            status: MessageStatus::Streaming,
            error: None,
            model: Some(config.model.clone()),
            provider_id: Some(config.provider_id),
            started_at,
            created_at: started_at,
        };
        self.store.append_message(assistant_entry).await?;
        self.store
            .update_leaf(conversation_id, assistant_msg_id)
            .await?;
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

        let req = ChatRequest {
            kind: config.kind,
            base_url: config.base_url,
            api_path: config.api_path,
            api_key: config.api_key,
            model: config.model,
            thinking_effort: config.thinking_effort,
            messages: linear_context,
        };

        let mut blocks: Vec<ContentBlock> = Vec::new();
        let mut open: Option<OpenBlock> = None;
        let mut final_usage = None;
        let mut final_stop = StopReason::Stop;
        let mut first_token_at: Option<i64> = None;

        let stream_result: Result<(), AgentError> = async {
            let mut stream = self.provider.stream(req).await?;
            while let Some(ev_res) = stream.next().await {
                let ev = ev_res?;
                match ev {
                    StreamEvent::Start => {}
                    StreamEvent::TextStart => {
                        if let Some(prev) = open.take() {
                            blocks.push(prev.close(None));
                        }
                        open = Some(OpenBlock::Text(String::new()));
                    }
                    StreamEvent::TextDelta { delta } => {
                        if first_token_at.is_none() {
                            first_token_at = Some(now_ms());
                        }
                        if !matches!(open, Some(OpenBlock::Text(_))) {
                            if let Some(prev) = open.take() {
                                blocks.push(prev.close(None));
                            }
                            open = Some(OpenBlock::Text(String::new()));
                        }
                        if let Some(OpenBlock::Text(text)) = &mut open {
                            text.push_str(&delta);
                        }
                        if let Some(obs) = &observer {
                            obs(TurnEvent::Delta { delta });
                        }
                    }
                    StreamEvent::TextEnd => {
                        if let Some(prev) = open.take() {
                            blocks.push(prev.close(None));
                        }
                    }
                    StreamEvent::ThinkingStart => {
                        if let Some(prev) = open.take() {
                            blocks.push(prev.close(None));
                        }
                        open = Some(OpenBlock::Thinking(String::new()));
                    }
                    StreamEvent::ThinkingDelta { delta } => {
                        if !matches!(open, Some(OpenBlock::Thinking(_))) {
                            if let Some(prev) = open.take() {
                                blocks.push(prev.close(None));
                            }
                            open = Some(OpenBlock::Thinking(String::new()));
                        }
                        if let Some(OpenBlock::Thinking(thinking)) = &mut open {
                            thinking.push_str(&delta);
                        }
                        if let Some(obs) = &observer {
                            obs(TurnEvent::ThinkingDelta { delta });
                        }
                    }
                    StreamEvent::ThinkingEnd { signature } => {
                        if let Some(prev) = open.take() {
                            blocks.push(prev.close(signature));
                        }
                    }
                    StreamEvent::ToolCallStart { id, name } => {
                        if let Some(prev) = open.take() {
                            blocks.push(prev.close(None));
                        }
                        open = Some(OpenBlock::ToolCall {
                            id,
                            name,
                            arguments: String::new(),
                        });
                    }
                    StreamEvent::ToolCallDelta { delta, .. } => {
                        if let Some(OpenBlock::ToolCall { arguments, .. }) = &mut open {
                            arguments.push_str(&delta);
                        }
                    }
                    StreamEvent::ToolCallEnd { call } => {
                        match open.take() {
                            Some(OpenBlock::ToolCall { ref id, .. }) if *id == call.id => {}
                            Some(prev) => blocks.push(prev.close(None)),
                            None => {}
                        }
                        blocks.push(ContentBlock::ToolCall(call));
                    }
                    StreamEvent::Done {
                        stop_reason,
                        usage,
                        ttft_ms,
                    } => {
                        final_stop = stop_reason;
                        final_usage = usage;
                        if let Some(ttft) = ttft_ms {
                            first_token_at = Some(started_at + ttft as i64);
                        }
                    }
                    StreamEvent::Error { message } => {
                        return Err(AgentError::Provider(message));
                    }
                }
            }
            Ok(())
        }
        .await;

        if let Some(prev) = open.take() {
            blocks.push(prev.close(None));
        }

        let full_text: String = blocks.iter().filter_map(ContentBlock::plain_text).collect();
        let content = if blocks.iter().all(|b| matches!(b, ContentBlock::Text(_))) {
            vec![ContentBlock::Text(TextContent {
                text: full_text.clone(),
            })]
        } else {
            blocks
        };
        let error = stream_result.as_ref().err().map(|e| e.to_string());
        let status = if error.is_none() {
            MessageStatus::Done
        } else {
            MessageStatus::Error
        };
        let final_assistant_msg = Message::Assistant {
            content,
            stop_reason: final_stop,
            usage: final_usage,
        };

        self.store
            .update_message(
                assistant_msg_id,
                MessageUpdate {
                    message: final_assistant_msg,
                    status,
                    error,
                    first_token_at,
                    finished_at: now_ms(),
                },
            )
            .await?;

        stream_result?;

        if let Some(obs) = &observer {
            obs(TurnEvent::AssistantDone {
                id: assistant_msg_id,
                full_text: full_text.clone(),
                usage: final_usage,
            });
        }

        Ok((assistant_msg_id, full_text))
    }
}
