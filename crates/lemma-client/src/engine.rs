use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use lemma_agent::{AgentConfig, TurnEvent};
use lemma_core::Message;
use lemma_session::{ConversationMeta, StoredMessage};
use uuid::Uuid;

use crate::error::ClientError;

/// Future returned by asynchronous client engine actions.
pub type BoxClientFuture<'a, T> = Pin<Box<dyn Future<Output = Result<T, ClientError>> + Send + 'a>>;

/// Operating mode of the client engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EngineMode {
    /// Zero-server on-device execution via local SQLite and direct provider connections.
    Local,
    /// ConnectRPC gateway-backed remote execution.
    Remote,
}

/// The single unified trait consumed by application UI layers (Desktop / Mobile).
///
/// Implementations isolate the UI from the choice of local on-device SQLite execution
/// versus remote ConnectRPC gateway execution.
pub trait ClientEngine: Send + Sync {
    /// Current execution mode of this engine instance.
    fn mode(&self) -> EngineMode;

    /// Creates a new conversation session.
    fn create_conversation<'a>(
        &'a self,
        id: Uuid,
        title: String,
    ) -> BoxClientFuture<'a, ConversationMeta>;

    /// Retrieves metadata for an existing conversation.
    fn get_conversation<'a>(&'a self, id: Uuid) -> BoxClientFuture<'a, Option<ConversationMeta>>;

    /// Retrieves chronological messages recorded for a conversation.
    fn list_messages<'a>(
        &'a self,
        conversation_id: Uuid,
    ) -> BoxClientFuture<'a, Vec<StoredMessage>>;

    /// Runs one turn of interaction, dispatching deltas and lifecycle events to `observer`.
    fn run_turn<'a>(
        &'a self,
        conversation_id: Uuid,
        user_message: Message,
        parent_id_override: Option<Uuid>,
        config: AgentConfig,
        observer: Option<Arc<dyn Fn(TurnEvent) + Send + Sync>>,
    ) -> BoxClientFuture<'a, (Uuid, String)>;
}
