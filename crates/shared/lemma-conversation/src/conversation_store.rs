//! Storage contract for the conversation domain.

use std::pin::Pin;

use uuid::Uuid;

use crate::error::ConversationError;
use crate::record::{Conversation, LastModel, Message, MessageUpdate};

/// Future returned by asynchronous conversation store operations.
pub type BoxConversationFuture<'a, T> =
    Pin<Box<dyn Future<Output = Result<T, ConversationError>> + Send + 'a>>;

/// Storage backend for conversations and messages. Implemented by both
/// db crates (`PgConversationStore`, `SqliteConversationStore`) so the
/// domain runs identically on server and local modes.
///
/// User isolation is per call: every conversation-scoped operation takes
/// the owning `user_id`; message operations address messages by id.
pub trait ConversationStore: Send + Sync {
    /// Creates an empty conversation and returns it.
    fn insert<'a>(&'a self, user_id: Uuid) -> BoxConversationFuture<'a, Conversation>;
    /// Lists a user's conversations, most recently updated first.
    fn list_by_user<'a>(&'a self, user_id: Uuid) -> BoxConversationFuture<'a, Vec<Conversation>>;

    /// Finds a conversation owned by the given user.
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

    /// Deletes a conversation owned by the user together with its
    /// messages, returning whether a row was removed.
    fn delete<'a>(&'a self, id: Uuid, user_id: Uuid) -> BoxConversationFuture<'a, bool>;

    /// Updates the active leaf pointer of a conversation owned by the
    /// given user.
    fn update_leaf<'a>(
        &'a self,
        id: Uuid,
        user_id: Uuid,
        leaf_id: Uuid,
    ) -> BoxConversationFuture<'a, ()>;

    /// Records the model selection used by a turn on a conversation owned
    /// by the given user.
    fn update_last_model<'a>(
        &'a self,
        id: Uuid,
        user_id: Uuid,
        last_model: LastModel,
    ) -> BoxConversationFuture<'a, ()>;

    /// Appends a new message node into the tree.
    fn append_message<'a>(&'a self, entry: Message) -> BoxConversationFuture<'a, ()>;

    /// Finalizes a placeholder message with its settled body and status.
    fn update_message<'a>(
        &'a self,
        id: Uuid,
        update: MessageUpdate,
    ) -> BoxConversationFuture<'a, ()>;

    /// Retrieves all messages recorded for a conversation, chronological
    /// order.
    fn list_messages<'a>(
        &'a self,
        conversation_id: Uuid,
    ) -> BoxConversationFuture<'a, Vec<Message>>;

    /// Keyset-paginates a conversation's messages newest-first. `before_id`
    /// selects messages older than that message; one extra row is fetched
    /// to compute `has_more`.
    fn list_messages_page<'a>(
        &'a self,
        conversation_id: Uuid,
        before_id: Option<Uuid>,
        limit: i64,
    ) -> BoxConversationFuture<'a, (Vec<Message>, bool)>;
}
