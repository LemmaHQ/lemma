use std::sync::Arc;

use futures::StreamExt;
use lemma_adapter::{ChatRequest, Provider, ProviderKind};
use lemma_core::{ContentBlock, Message, StopReason, StreamEvent, TextContent, Usage};
use lemma_session::{StoredMessage, TraceStore, build_context_path};
use uuid::Uuid;

use crate::error::AgentError;

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

        // 1. Determine parent ID for the new User turn.
        let user_parent_id = parent_id_override.or(meta.leaf_id);

        let user_msg_id = Uuid::new_v4();
        let user_entry = StoredMessage {
            id: user_msg_id,
            conversation_id,
            parent_id: user_parent_id,
            message: user_message,
            created_at: 0,
        };

        self.store.append_message(user_entry).await?;
        self.store.update_leaf(conversation_id, user_msg_id).await?;

        if let Some(obs) = &observer {
            obs(TurnEvent::UserAppended { id: user_msg_id });
        }

        // 2. Reconstruct linear context history from root to this new user message.
        let all_entries = self.store.list_messages(conversation_id).await?;
        let linear_context = build_context_path(&all_entries, user_msg_id)?;

        // 3. Pre-create Assistant node in the tree so partial state is visible.
        let assistant_msg_id = Uuid::new_v4();
        let initial_assistant_msg = Message::Assistant {
            content: vec![ContentBlock::Text(TextContent {
                text: String::new(),
            })],
            stop_reason: StopReason::Stop,
            usage: None,
        };

        let assistant_entry = StoredMessage {
            id: assistant_msg_id,
            conversation_id,
            parent_id: Some(user_msg_id),
            message: initial_assistant_msg,
            created_at: 0,
        };
        self.store.append_message(assistant_entry).await?;
        self.store
            .update_leaf(conversation_id, assistant_msg_id)
            .await?;

        // 4. Dispatch to provider.
        let req = ChatRequest {
            kind: config.kind,
            base_url: config.base_url,
            api_path: config.api_path,
            api_key: config.api_key,
            model: config.model,
            messages: linear_context,
        };

        let mut stream = self.provider.stream(req).await?;
        let mut full_text = String::new();
        let mut final_usage = None;

        while let Some(ev_res) = stream.next().await {
            let ev = ev_res?;
            match ev {
                StreamEvent::TextDelta { delta } => {
                    full_text.push_str(&delta);
                    if let Some(obs) = &observer {
                        obs(TurnEvent::Delta { delta });
                    }
                }
                StreamEvent::Done { usage, .. } => {
                    final_usage = usage;
                }
                _ => {}
            }
        }

        // 5. Finalize assistant turn with accumulated text and token usage.
        let final_assistant_msg = Message::Assistant {
            content: vec![ContentBlock::Text(TextContent {
                text: full_text.clone(),
            })],
            stop_reason: StopReason::Stop,
            usage: final_usage,
        };

        self.store
            .update_message(assistant_msg_id, final_assistant_msg)
            .await?;

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
