use std::sync::Arc;

use futures::StreamExt;
use lemma_adapter::{ChatRequest, Provider, ProviderKind};
use lemma_core::{ContentBlock, Message, StopReason, StreamEvent, TextContent};
use lemma_session::{StoredMessage, TraceStore, build_context_path};
use uuid::Uuid;

use crate::error::AgentError;

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

    /// Appends a user prompt to a conversation, optionally under a specific parent node
    /// (to form a new branch), executes the generation step, and stores the resulting assistant turn.
    pub async fn run_turn(
        &self,
        conversation_id: Uuid,
        user_message: Message,
        parent_id_override: Option<Uuid>,
        config: AgentConfig,
    ) -> Result<(Uuid, String), AgentError> {
        let meta = self
            .store
            .get_conversation(conversation_id)
            .await?
            .ok_or_else(|| {
                AgentError::NotFound(format!("conversation {conversation_id} not found"))
            })?;

        // 1. Determine parent ID for the new User turn.
        // Defaults to current active leaf, or parent_id_override if branching off historical point.
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

        // 2. Reconstruct linear context history from root to this new user message.
        let all_entries = self.store.list_messages(conversation_id).await?;
        let linear_context = build_context_path(&all_entries, user_msg_id)?;

        // 3. Dispatch to provider.
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

        while let Some(ev_res) = stream.next().await {
            let ev = ev_res?;
            if let StreamEvent::TextDelta { delta } = ev {
                full_text.push_str(&delta);
            }
        }

        // 4. Save Assistant turn as child of the User message.
        let assistant_msg_id = Uuid::new_v4();
        let assistant_msg = Message::Assistant {
            content: vec![ContentBlock::Text(TextContent {
                text: full_text.clone(),
            })],
            stop_reason: StopReason::Stop,
            usage: None,
        };

        let assistant_entry = StoredMessage {
            id: assistant_msg_id,
            conversation_id,
            parent_id: Some(user_msg_id),
            message: assistant_msg,
            created_at: 0,
        };

        self.store.append_message(assistant_entry).await?;
        self.store
            .update_leaf(conversation_id, assistant_msg_id)
            .await?;

        Ok((assistant_msg_id, full_text))
    }
}
