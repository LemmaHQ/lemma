//! Storage contract for the conversation domain.

use uuid::Uuid;

use crate::conversation_error::ConversationError;
use crate::record::{Conversation, LastModel, Message, MessagePage, MessageUpdate};

/// Storage backend for conversations and messages. Implemented by both
/// db crates (`PgConversationStore`, `SqliteConversationStore`) so the
/// domain runs identically on server and local modes. Clones share one
/// connection pool.
///
/// User isolation is per call: every conversation-scoped operation takes
/// the owning `user_id`; message operations address messages by id. Every
/// operation fails with [`ConversationError::Store`] when the backend
/// fails.
pub trait ConversationStore: Clone + Send + Sync + 'static {
    /// Creates an empty conversation and returns it.
    fn insert(
        &self,
        user_id: Uuid,
    ) -> impl Future<Output = Result<Conversation, ConversationError>> + Send;

    /// Lists a user's conversations, most recently updated first.
    fn list_by_user(
        &self,
        user_id: Uuid,
    ) -> impl Future<Output = Result<Vec<Conversation>, ConversationError>> + Send;

    /// Finds a conversation owned by the given user.
    fn find_by_id_and_user(
        &self,
        id: Uuid,
        user_id: Uuid,
    ) -> impl Future<Output = Result<Option<Conversation>, ConversationError>> + Send;

    /// Renames a conversation owned by the given user.
    fn rename(
        &self,
        id: Uuid,
        user_id: Uuid,
        title: &str,
    ) -> impl Future<Output = Result<Option<Conversation>, ConversationError>> + Send;

    /// Deletes a conversation owned by the user together with its
    /// messages, returning whether a row was removed.
    fn delete(
        &self,
        id: Uuid,
        user_id: Uuid,
    ) -> impl Future<Output = Result<bool, ConversationError>> + Send;

    /// Updates the active leaf pointer of a conversation owned by the
    /// given user.
    fn update_leaf(
        &self,
        id: Uuid,
        user_id: Uuid,
        leaf_id: Uuid,
    ) -> impl Future<Output = Result<(), ConversationError>> + Send;

    /// Records the model selection used by a turn on a conversation owned
    /// by the given user.
    fn update_last_model(
        &self,
        id: Uuid,
        user_id: Uuid,
        last_model: &LastModel,
    ) -> impl Future<Output = Result<(), ConversationError>> + Send;

    /// Appends a new message node into the tree.
    fn append_message(
        &self,
        entry: &Message,
    ) -> impl Future<Output = Result<(), ConversationError>> + Send;

    /// Finalizes a placeholder message with its settled body and status.
    fn update_message(
        &self,
        id: Uuid,
        update: &MessageUpdate,
    ) -> impl Future<Output = Result<(), ConversationError>> + Send;

    /// Retrieves all messages recorded for a conversation, chronological
    /// order.
    fn list_messages(
        &self,
        conversation_id: Uuid,
    ) -> impl Future<Output = Result<Vec<Message>, ConversationError>> + Send;

    /// Keyset-paginates a conversation's messages newest-first. `before_id`
    /// selects messages older than that message.
    fn list_messages_page(
        &self,
        conversation_id: Uuid,
        before_id: Option<Uuid>,
        limit: i64,
    ) -> impl Future<Output = Result<MessagePage, ConversationError>> + Send;
}
