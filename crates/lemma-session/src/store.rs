use std::future::Future;
use std::pin::Pin;

use uuid::Uuid;

use crate::error::SessionError;

/// Future returned by asynchronous trace store operations.
pub type BoxStoreFuture<'a, T> = Pin<Box<dyn Future<Output = Result<T, SessionError>> + Send + 'a>>;

/// Metadata describing a conversation session.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ConversationMeta {
    /// Unique identifier.
    pub id: Uuid,
    /// Human-readable title.
    pub title: String,
    /// Active branch leaf node id. `None` when empty.
    pub leaf_id: Option<Uuid>,
    /// Whether this conversation is restricted to local-only mode.
    pub local_only: bool,
    /// Model last used in this conversation; `None` before the first turn.
    pub last_model: Option<LastModel>,
    /// Unix timestamp of creation.
    pub created_at: i64,
    /// Unix timestamp of latest update.
    pub updated_at: i64,
}

/// The model selection last used in a conversation, restored when the
/// conversation is reopened.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct LastModel {
    /// Provider the turn was dispatched to.
    pub provider_id: Uuid,
    /// Model identifier as configured on the provider.
    pub model: String,
    /// Reasoning effort level, when the model exposes one.
    pub thinking_effort: Option<String>,
}

/// A persisted trace entry within a conversation session tree.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StoredMessage {
    /// Message unique ID.
    pub id: Uuid,
    /// Owning conversation ID.
    pub conversation_id: Uuid,
    /// Parent message ID in the conversation tree.
    pub parent_id: Option<Uuid>,
    /// Canonical trace message body.
    pub message: lemma_core::Message,
    /// Lifecycle status of the entry.
    pub status: MessageStatus,
    /// Provider row the message was dispatched to, when known.
    pub provider_id: Option<Uuid>,
    /// Model identifier that produced the entry, when known.
    pub model: Option<String>,
    /// Turn start timestamp in Unix epoch milliseconds.
    pub started_at: i64,
    /// Created timestamp in Unix epoch milliseconds.
    pub created_at: i64,
}

/// Lifecycle status of a stored message.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MessageStatus {
    /// Generation in progress; the row is a placeholder.
    Streaming,
    /// Generation completed normally.
    Done,
    /// Generation cancelled by the user.
    Aborted,
    /// Generation failed.
    Error,
}

/// Finalization payload applied to a placeholder message when its
/// generation settles.
#[derive(Debug, Clone)]
pub struct MessageUpdate {
    /// Final canonical message body.
    pub message: lemma_core::Message,
    /// Terminal lifecycle status.
    pub status: MessageStatus,
    /// First-token timestamp in Unix epoch milliseconds.
    pub first_token_at: Option<i64>,
    /// Turn end timestamp in Unix epoch milliseconds.
    pub finished_at: i64,
}

/// Trait abstracting conversation persistence.
///
/// Implemented by PostgreSQL (`lemma-conversations` on server) and
/// SQLite (`lemma-db-client` on clients).
pub trait TraceStore: Send + Sync {
    /// Creates a new conversation entry.
    fn create_conversation<'a>(
        &'a self,
        id: Uuid,
        title: String,
        local_only: bool,
    ) -> BoxStoreFuture<'a, ConversationMeta>;

    /// Retrieves conversation metadata.
    fn get_conversation<'a>(&'a self, id: Uuid) -> BoxStoreFuture<'a, Option<ConversationMeta>>;

    /// Updates the active leaf pointer of a conversation.
    fn update_leaf<'a>(&'a self, id: Uuid, leaf_id: Uuid) -> BoxStoreFuture<'a, ()>;

    /// Finalizes a placeholder message with its settled body, status and
    /// timing marks.
    fn update_message<'a>(&'a self, id: Uuid, update: MessageUpdate) -> BoxStoreFuture<'a, ()>;

    /// Records the model selection used by a turn on the conversation.
    fn update_conversation_model<'a>(
        &'a self,
        id: Uuid,
        last_model: LastModel,
    ) -> BoxStoreFuture<'a, ()>;

    /// Appends a new message node into the tree.
    fn append_message<'a>(&'a self, entry: StoredMessage) -> BoxStoreFuture<'a, ()>;

    /// Retrieves all messages recorded for a conversation.
    fn list_messages<'a>(&'a self, conversation_id: Uuid)
    -> BoxStoreFuture<'a, Vec<StoredMessage>>;
}
