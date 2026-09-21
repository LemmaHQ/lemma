use std::sync::Arc;

use lemma_agent::{AgentConfig, TurnEvent};
use lemma_core::Message;
use lemma_session::{ConversationMeta, StoredMessage};
use uuid::Uuid;

use crate::engine::{BoxClientFuture, ClientEngine, EngineMode};
use crate::error::ClientError;

/// Remote mode client engine, communicating over ConnectRPC to the lemma-server gateway.
pub struct RemoteClientEngine {
    server_url: String,
    bearer_token: Option<String>,
}

impl RemoteClientEngine {
    /// Creates a new remote client pointing to `server_url`.
    pub fn new(server_url: impl Into<String>, bearer_token: Option<String>) -> Self {
        Self {
            server_url: server_url.into(),
            bearer_token,
        }
    }

    /// Server endpoint URL.
    pub fn server_url(&self) -> &str {
        &self.server_url
    }

    /// Optional bearer token for authentication.
    pub fn bearer_token(&self) -> Option<&str> {
        self.bearer_token.as_deref()
    }
}

impl ClientEngine for RemoteClientEngine {
    fn mode(&self) -> EngineMode {
        EngineMode::Remote
    }

    fn create_conversation<'a>(
        &'a self,
        _id: Uuid,
        _title: String,
    ) -> BoxClientFuture<'a, ConversationMeta> {
        Box::pin(async move {
            Err(ClientError::Remote(
                "remote conversation creation via RPC client will be wired in Phase 6".to_string(),
            ))
        })
    }

    fn get_conversation<'a>(&'a self, _id: Uuid) -> BoxClientFuture<'a, Option<ConversationMeta>> {
        Box::pin(async move {
            Err(ClientError::Remote(
                "remote conversation lookup via RPC client will be wired in Phase 6".to_string(),
            ))
        })
    }

    fn list_messages<'a>(
        &'a self,
        _conversation_id: Uuid,
    ) -> BoxClientFuture<'a, Vec<StoredMessage>> {
        Box::pin(async move {
            Err(ClientError::Remote(
                "remote message listing via RPC client will be wired in Phase 6".to_string(),
            ))
        })
    }

    fn run_turn<'a>(
        &'a self,
        _conversation_id: Uuid,
        _user_message: Message,
        _parent_id_override: Option<Uuid>,
        _config: AgentConfig,
        _observer: Option<Arc<dyn Fn(TurnEvent) + Send + Sync>>,
    ) -> BoxClientFuture<'a, (Uuid, String)> {
        Box::pin(async move {
            Err(ClientError::Remote(
                "remote turn execution via ChatService RPC stream will be wired in Phase 6"
                    .to_string(),
            ))
        })
    }
}
