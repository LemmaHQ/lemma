//! Conversation business flows: lifecycle (create, rename, delete) and
//! message pagination over a [`ConversationStore`] backend.

use uuid::Uuid;

use crate::conversation_error::ConversationError;
use crate::conversation_store::ConversationStore;
use crate::record::{Conversation, MessagePage};

/// Default page size for message listing.
pub const DEFAULT_PAGE_LIMIT: i32 = 50;

/// Maximum page size for message listing.
pub const MAX_PAGE_LIMIT: i32 = 100;

/// Conversation domain service over a [`ConversationStore`] backend.
///
/// Deletion removes a conversation together with its messages.
#[derive(Debug)]
pub struct ConversationService<S> {
    store: S,
}

impl<S: ConversationStore> ConversationService<S> {
    /// Creates the service over a store backend.
    pub fn new(store: S) -> Self {
        Self { store }
    }

    /// Lists the user's conversations.
    ///
    /// # Errors
    ///
    /// Propagates the store's [`ConversationError`].
    pub async fn list_conversations(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<Conversation>, ConversationError> {
        self.store.list_by_user(user_id).await
    }

    /// Creates an empty conversation for the user.
    ///
    /// # Errors
    ///
    /// Propagates the store's [`ConversationError`].
    pub async fn create(&self, user_id: Uuid) -> Result<Conversation, ConversationError> {
        self.store.insert(user_id).await
    }

    /// Renames a conversation owned by the user.
    ///
    /// # Errors
    ///
    /// [`ConversationError::TitleRequired`] for a blank title,
    /// [`ConversationError::NotFound`] when the user owns no such
    /// conversation; otherwise propagates the store's error.
    pub async fn rename(
        &self,
        user_id: Uuid,
        id: Uuid,
        title: &str,
    ) -> Result<Conversation, ConversationError> {
        let title = title.trim();
        if title.is_empty() {
            return Err(ConversationError::TitleRequired);
        }
        self.store
            .rename(id, user_id, title)
            .await?
            .ok_or(ConversationError::NotFound)
    }

    /// Lists a conversation's messages newest-first with keyset
    /// pagination. `limit` is clamped to [`DEFAULT_PAGE_LIMIT`] and
    /// [`MAX_PAGE_LIMIT`].
    ///
    /// # Errors
    ///
    /// [`ConversationError::NotFound`] when the user owns no such
    /// conversation; otherwise propagates the store's error.
    pub async fn list_messages(
        &self,
        user_id: Uuid,
        conversation_id: Uuid,
        before_id: Option<Uuid>,
        limit: i32,
    ) -> Result<MessagePage, ConversationError> {
        self.store
            .find_by_id_and_user(conversation_id, user_id)
            .await?
            .ok_or(ConversationError::NotFound)?;
        let limit = if limit <= 0 {
            DEFAULT_PAGE_LIMIT
        } else {
            limit.min(MAX_PAGE_LIMIT)
        };
        self.store
            .list_messages_page(conversation_id, before_id, i64::from(limit))
            .await
    }

    /// Permanently deletes a conversation owned by the user together
    /// with its messages.
    ///
    /// # Errors
    ///
    /// [`ConversationError::NotFound`] when the user owns no such
    /// conversation; otherwise propagates the store's error.
    pub async fn delete(&self, user_id: Uuid, id: Uuid) -> Result<(), ConversationError> {
        if !self.store.delete(id, user_id).await? {
            return Err(ConversationError::NotFound);
        }
        Ok(())
    }
}
