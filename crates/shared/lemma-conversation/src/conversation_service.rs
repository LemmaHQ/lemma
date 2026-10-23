//! Conversation business flows: lifecycle (create, rename, delete) and
//! message pagination over a [`ConversationStore`] backend.

use std::sync::Arc;

use uuid::Uuid;

use crate::error::ConversationError;
use crate::record::{Conversation, Message};
use crate::store::ConversationStore;

/// Default page size for message listing.
pub const DEFAULT_PAGE_LIMIT: i32 = 50;

/// Maximum page size for message listing.
pub const MAX_PAGE_LIMIT: i32 = 100;

/// Conversation domain service over a [`ConversationStore`] backend.
///
/// Deletion removes a conversation together with its messages.
pub struct ConversationService {
    store: Arc<dyn ConversationStore>,
}

impl ConversationService {
    /// Creates the service over a store backend.
    pub fn new(store: Arc<dyn ConversationStore>) -> Self {
        Self { store }
    }

    /// Lists the user's conversations.
    pub async fn list_conversations(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<Conversation>, ConversationError> {
        self.store.list_by_user(user_id).await
    }

    /// Creates an empty conversation for the user.
    pub async fn create(&self, user_id: Uuid) -> Result<Conversation, ConversationError> {
        self.store.insert(user_id).await
    }

    /// Renames a conversation owned by the user.
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
    pub async fn list_messages(
        &self,
        user_id: Uuid,
        conversation_id: Uuid,
        before_id: Option<Uuid>,
        limit: i32,
    ) -> Result<(Vec<Message>, bool), ConversationError> {
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
            .list_messages_page(conversation_id, before_id, limit as i64)
            .await
    }

    /// Permanently deletes a conversation owned by the user together
    /// with its messages.
    pub async fn delete(&self, user_id: Uuid, id: Uuid) -> Result<(), ConversationError> {
        if !self.store.delete(id, user_id).await? {
            return Err(ConversationError::NotFound);
        }
        Ok(())
    }
}
