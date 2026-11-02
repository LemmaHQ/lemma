use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use uuid::Uuid;

use crate::Conversation;
use crate::conversation_error::ConversationError;
use crate::entity::conversation::{self, LastModel};

/// Conversation domain service over a database holding the conversations
/// and messages tables. Clones share one connection pool.
///
/// Deletion removes a conversation together with its messages. Every
/// conversation-scoped operation takes the owning `user_id`; message
/// operations address messages by id.
#[derive(Debug, Clone)]
pub struct ConversationService {
    pub(super) db: DatabaseConnection,
}

impl ConversationService {
    /// Creates the service over a database.
    #[must_use]
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    /// Lists the user's conversations, most recently updated first.
    ///
    /// # Errors
    ///
    /// [`ConversationError::Store`] when the database fails.
    pub async fn list_conversations(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<Conversation>, ConversationError> {
        Ok(conversation::Entity::find()
            .filter(conversation::Column::UserId.eq(user_id))
            .order_by_desc(conversation::Column::UpdatedAt)
            .all(&self.db)
            .await?)
    }

    /// Creates an empty conversation for the user.
    ///
    /// # Errors
    ///
    /// [`ConversationError::Store`] when the database fails.
    pub async fn create(&self, user_id: Uuid) -> Result<Conversation, ConversationError> {
        let now = Utc::now();
        Ok(conversation::ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_id),
            title: Set(String::new()),
            leaf_id: Set(None),
            last_model: Set(None),
            created_at: Set(now),
            updated_at: Set(now),
        }
        .insert(&self.db)
        .await?)
    }

    /// Finds a conversation owned by the user.
    ///
    /// # Errors
    ///
    /// [`ConversationError::Store`] when the database fails.
    pub async fn find(
        &self,
        user_id: Uuid,
        id: Uuid,
    ) -> Result<Option<Conversation>, ConversationError> {
        Ok(conversation::Entity::find_by_id(id)
            .filter(conversation::Column::UserId.eq(user_id))
            .one(&self.db)
            .await?)
    }

    /// Renames a conversation owned by the user.
    ///
    /// # Errors
    ///
    /// [`ConversationError::TitleRequired`] for a blank title,
    /// [`ConversationError::NotFound`] when the user owns no such
    /// conversation, and [`ConversationError::Store`] when the database
    /// fails.
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
        conversation::Entity::update_many()
            .set(conversation::ActiveModel {
                title: Set(title.to_owned()),
                updated_at: Set(Utc::now()),
                ..Default::default()
            })
            .filter(conversation::Column::Id.eq(id))
            .filter(conversation::Column::UserId.eq(user_id))
            .exec_with_returning(&self.db)
            .await?
            .pop()
            .ok_or(ConversationError::NotFound)
    }

    /// Permanently deletes a conversation owned by the user together
    /// with its messages.
    ///
    /// # Errors
    ///
    /// [`ConversationError::NotFound`] when the user owns no such
    /// conversation and [`ConversationError::Store`] when the database
    /// fails.
    pub async fn delete(&self, user_id: Uuid, id: Uuid) -> Result<(), ConversationError> {
        let deleted = conversation::Entity::delete_many()
            .filter(conversation::Column::Id.eq(id))
            .filter(conversation::Column::UserId.eq(user_id))
            .exec(&self.db)
            .await?;
        if deleted.rows_affected == 0 {
            return Err(ConversationError::NotFound);
        }
        Ok(())
    }

    /// Moves the active leaf of a conversation owned by the user.
    ///
    /// # Errors
    ///
    /// [`ConversationError::Store`] when the database fails.
    pub async fn update_leaf(
        &self,
        user_id: Uuid,
        id: Uuid,
        leaf_id: Uuid,
    ) -> Result<(), ConversationError> {
        self.update_owned(
            user_id,
            id,
            conversation::ActiveModel {
                leaf_id: Set(Some(leaf_id)),
                ..Default::default()
            },
        )
        .await
    }

    /// Records the model selection used by a turn on a conversation owned
    /// by the user.
    ///
    /// # Errors
    ///
    /// [`ConversationError::Store`] when the database fails.
    pub async fn update_last_model(
        &self,
        user_id: Uuid,
        id: Uuid,
        last_model: &LastModel,
    ) -> Result<(), ConversationError> {
        self.update_owned(
            user_id,
            id,
            conversation::ActiveModel {
                last_model: Set(Some(last_model.clone())),
                ..Default::default()
            },
        )
        .await
    }

    async fn update_owned(
        &self,
        user_id: Uuid,
        id: Uuid,
        changes: conversation::ActiveModel,
    ) -> Result<(), ConversationError> {
        conversation::Entity::update_many()
            .set(conversation::ActiveModel {
                updated_at: Set(Utc::now()),
                ..changes
            })
            .filter(conversation::Column::Id.eq(id))
            .filter(conversation::Column::UserId.eq(user_id))
            .exec(&self.db)
            .await?;
        Ok(())
    }
}
