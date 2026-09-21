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
    /// Unix timestamp of creation.
    pub created_at: i64,
    /// Unix timestamp of latest update.
    pub updated_at: i64,
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
    /// Created timestamp in Unix epoch milliseconds.
    pub created_at: i64,
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

    /// Updates the message payload of an existing entry.
    fn update_message<'a>(
        &'a self,
        id: Uuid,
        message: lemma_core::Message,
    ) -> BoxStoreFuture<'a, ()>;

    /// Appends a new message node into the tree.
    fn append_message<'a>(&'a self, entry: StoredMessage) -> BoxStoreFuture<'a, ()>;

    /// Retrieves all messages recorded for a conversation.
    fn list_messages<'a>(&'a self, conversation_id: Uuid)
    -> BoxStoreFuture<'a, Vec<StoredMessage>>;
}
