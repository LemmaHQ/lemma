use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use uuid::Uuid;

use crate::Session;
use crate::entity::session::{self, LastModel};
use crate::session_error::SessionError;

/// Session domain service over a database holding the sessions
/// and messages tables. Clones share one connection pool.
///
/// Deletion removes a session together with its messages. Every
/// session-scoped operation takes the owning `user_id`; message
/// operations address messages by id.
#[derive(Debug, Clone)]
pub struct SessionService {
    pub(super) db: DatabaseConnection,
}

impl SessionService {
    /// Creates the service over a database.
    #[must_use]
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    /// Lists the user's sessions, most recently updated first.
    ///
    /// # Errors
    ///
    /// [`SessionError::Store`] when the database fails.
    pub async fn list_sessions(&self, user_id: Uuid) -> Result<Vec<Session>, SessionError> {
        Ok(session::Entity::find()
            .filter(session::Column::UserId.eq(user_id))
            .order_by_desc(session::Column::UpdatedAt)
            .all(&self.db)
            .await?)
    }

    /// Creates an empty session for the user.
    ///
    /// # Errors
    ///
    /// [`SessionError::Store`] when the database fails.
    pub async fn create(&self, user_id: Uuid) -> Result<Session, SessionError> {
        let now = Utc::now();
        Ok(session::ActiveModel {
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

    /// Finds a session owned by the user.
    ///
    /// # Errors
    ///
    /// [`SessionError::Store`] when the database fails.
    pub async fn find(&self, user_id: Uuid, id: Uuid) -> Result<Option<Session>, SessionError> {
        Ok(session::Entity::find_by_id(id)
            .filter(session::Column::UserId.eq(user_id))
            .one(&self.db)
            .await?)
    }

    /// Renames a session owned by the user.
    ///
    /// # Errors
    ///
    /// [`SessionError::TitleRequired`] for a blank title,
    /// [`SessionError::NotFound`] when the user owns no such
    /// session, and [`SessionError::Store`] when the database
    /// fails.
    pub async fn rename(
        &self,
        user_id: Uuid,
        id: Uuid,
        title: &str,
    ) -> Result<Session, SessionError> {
        let title = title.trim();
        if title.is_empty() {
            return Err(SessionError::TitleRequired);
        }
        session::Entity::update_many()
            .set(session::ActiveModel {
                title: Set(title.to_owned()),
                updated_at: Set(Utc::now()),
                ..Default::default()
            })
            .filter(session::Column::Id.eq(id))
            .filter(session::Column::UserId.eq(user_id))
            .exec_with_returning(&self.db)
            .await?
            .pop()
            .ok_or(SessionError::NotFound)
    }

    /// Permanently deletes a session owned by the user together
    /// with its messages.
    ///
    /// # Errors
    ///
    /// [`SessionError::NotFound`] when the user owns no such
    /// session and [`SessionError::Store`] when the database
    /// fails.
    pub async fn delete(&self, user_id: Uuid, id: Uuid) -> Result<(), SessionError> {
        let deleted = session::Entity::delete_many()
            .filter(session::Column::Id.eq(id))
            .filter(session::Column::UserId.eq(user_id))
            .exec(&self.db)
            .await?;
        if deleted.rows_affected == 0 {
            return Err(SessionError::NotFound);
        }
        Ok(())
    }

    /// Moves the active leaf of a session owned by the user.
    ///
    /// # Errors
    ///
    /// [`SessionError::Store`] when the database fails.
    pub async fn update_leaf(
        &self,
        user_id: Uuid,
        id: Uuid,
        leaf_id: Uuid,
    ) -> Result<(), SessionError> {
        self.update_owned(
            user_id,
            id,
            session::ActiveModel {
                leaf_id: Set(Some(leaf_id)),
                ..Default::default()
            },
        )
        .await
    }

    /// Records the model selection used by a turn on a session owned
    /// by the user.
    ///
    /// # Errors
    ///
    /// [`SessionError::Store`] when the database fails.
    pub async fn update_last_model(
        &self,
        user_id: Uuid,
        id: Uuid,
        last_model: &LastModel,
    ) -> Result<(), SessionError> {
        self.update_owned(
            user_id,
            id,
            session::ActiveModel {
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
        changes: session::ActiveModel,
    ) -> Result<(), SessionError> {
        session::Entity::update_many()
            .set(session::ActiveModel {
                updated_at: Set(Utc::now()),
                ..changes
            })
            .filter(session::Column::Id.eq(id))
            .filter(session::Column::UserId.eq(user_id))
            .exec(&self.db)
            .await?;
        Ok(())
    }
}
