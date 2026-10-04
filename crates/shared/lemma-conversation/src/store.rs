//! Storage contract for the conversation domain.

use std::pin::Pin;

use uuid::Uuid;

use crate::error::ConversationError;
use crate::record::{Conversation, Message};

/// Future returned by asynchronous conversation store operations.
pub type BoxConversationFuture<'a, T> =
    Pin<Box<dyn Future<Output = Result<T, ConversationError>> + Send + 'a>>;

/// Storage backend for conversations and messages. Implemented by both
/// db crates (`PgConversationStore`, `SqliteConversationStore`) so the
/// domain runs identically on server and local modes.
pub trait ConversationStore: Send + Sync {
    /// Creates an empty conversation and returns it.
    fn insert<'a>(&'a self, user_id: Uuid) -> BoxConversationFuture<'a, Conversation>;

    /// Lists a user's active conversations, most recently updated first.
    fn list_active_by_user<'a>(
        &'a self,
        user_id: Uuid,
    ) -> BoxConversationFuture<'a, Vec<Conversation>>;

    /// Lists a user's archived conversations, most recently archived first.
    fn list_archived_by_user<'a>(
        &'a self,
        user_id: Uuid,
    ) -> BoxConversationFuture<'a, Vec<Conversation>>;

    /// Finds a conversation owned by the given user, any status.
    fn find_by_id_and_user<'a>(
        &'a self,
        id: Uuid,
        user_id: Uuid,
    ) -> BoxConversationFuture<'a, Option<Conversation>>;

    /// Renames a conversation owned by the given user.
    fn rename<'a>(
        &'a self,
        id: Uuid,
        user_id: Uuid,
        title: &'a str,
    ) -> BoxConversationFuture<'a, Option<Conversation>>;

    /// Archives an active conversation without touching its messages.
    /// Returns `None` unless the conversation is currently active.
    fn archive<'a>(
        &'a self,
        id: Uuid,
        user_id: Uuid,
    ) -> BoxConversationFuture<'a, Option<Conversation>>;

    /// Restores an archived conversation to active, clearing the archive
    /// metadata. Returns `None` unless the conversation is currently
    /// archived.
    fn restore<'a>(
        &'a self,
        id: Uuid,
        user_id: Uuid,
    ) -> BoxConversationFuture<'a, Option<Conversation>>;

    /// Deletes an archived conversation, returning whether a row was
    /// removed. Active conversations are not deletable through this path.
    fn delete_archived<'a>(&'a self, id: Uuid, user_id: Uuid) -> BoxConversationFuture<'a, bool>;

    /// Keyset-paginates a conversation's messages newest-first. `before_id`
    /// selects messages older than that message; one extra row is fetched
    /// to compute `has_more`.
    fn list_messages<'a>(
        &'a self,
        conversation_id: Uuid,
        before_id: Option<Uuid>,
        limit: i64,
    ) -> BoxConversationFuture<'a, (Vec<Message>, bool)>;
}
