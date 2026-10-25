//! Conversation business flows over a database: lifecycle (create, rename,
//! delete), message pagination, and the reads and writes a turn needs.

use chrono::Utc;
use sea_orm::sea_query::{Expr, ExprTrait};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, DbErr, EntityTrait, QueryFilter, QueryOrder,
    QuerySelect, Set, Unchanged,
};
use uuid::Uuid;

use crate::conversation_error::ConversationError;
use crate::entity::conversation::{self, LastModel};
use crate::entity::message::{self, MessageBody, MessageStatus};
use crate::{Conversation, Message};

const DEFAULT_PAGE_LEN: usize = 50;

/// Finalization payload applied to a placeholder message when its
/// generation settles.
#[derive(Debug, Clone)]
pub struct MessageUpdate {
    /// Final canonical message body.
    pub body: MessageBody,
    /// Terminal lifecycle status.
    pub status: MessageStatus,
    /// Failure reason when status is `Error`; `None` otherwise.
    pub error: Option<String>,
}

/// One page of a conversation's messages, newest first.
#[derive(Debug, Clone)]
pub struct MessagePage {
    /// Messages on this page.
    pub messages: Vec<Message>,
    /// Whether older messages follow this page.
    pub has_more: bool,
}

/// Conversation domain service over a database holding the conversations
/// and messages tables. Clones share one connection pool.
///
/// Deletion removes a conversation together with its messages. Every
/// conversation-scoped operation takes the owning `user_id`; message
/// operations address messages by id.
#[derive(Debug, Clone)]
pub struct ConversationService {
    db: DatabaseConnection,
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
        conversation::Entity::update(conversation::ActiveModel {
            id: Unchanged(id),
            title: Set(title.to_owned()),
            updated_at: Set(Utc::now()),
            ..Default::default()
        })
        .validate()?
        .filter(conversation::Column::UserId.eq(user_id))
        .exec(&self.db)
        .await
        .map_err(|e| match e {
            DbErr::RecordNotUpdated => ConversationError::NotFound,
            e => e.into(),
        })
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

    /// Appends a new message node into the tree.
    ///
    /// # Errors
    ///
    /// [`ConversationError::Store`] when the database fails, including a
    /// conversation that does not exist.
    pub async fn append_message(&self, entry: Message) -> Result<(), ConversationError> {
        message::Entity::insert(message::ActiveModel::from(entry))
            .exec_without_returning(&self.db)
            .await?;
        Ok(())
    }

    /// Finalizes a placeholder message with its settled body and status.
    ///
    /// # Errors
    ///
    /// [`ConversationError::Store`] when the database fails.
    pub async fn update_message(
        &self,
        id: Uuid,
        update: MessageUpdate,
    ) -> Result<(), ConversationError> {
        message::Entity::update_many()
            .set(message::ActiveModel {
                body: Set(update.body),
                status: Set(update.status),
                error: Set(update.error),
                updated_at: Set(Utc::now()),
                ..Default::default()
            })
            .filter(message::Column::Id.eq(id))
            .exec(&self.db)
            .await?;
        Ok(())
    }

    /// Retrieves every message of a conversation, oldest first.
    ///
    /// # Errors
    ///
    /// [`ConversationError::Store`] when the database fails.
    pub async fn all_messages(
        &self,
        conversation_id: Uuid,
    ) -> Result<Vec<Message>, ConversationError> {
        Ok(message::Entity::find()
            .filter(message::Column::ConversationId.eq(conversation_id))
            .order_by_asc(message::Column::CreatedAt)
            .order_by_asc(message::Column::Id)
            .all(&self.db)
            .await?)
    }

    /// Lists a conversation's messages newest-first with keyset
    /// pagination: `before_id` selects messages older than that message,
    /// and an unknown `before_id` yields an empty page. A `limit` that is
    /// not positive, as when the request omits it, returns 50 messages.
    ///
    /// # Errors
    ///
    /// [`ConversationError::NotFound`] when the user owns no such
    /// conversation and [`ConversationError::Store`] when the database
    /// fails.
    pub async fn list_messages(
        &self,
        user_id: Uuid,
        conversation_id: Uuid,
        before_id: Option<Uuid>,
        limit: i32,
    ) -> Result<MessagePage, ConversationError> {
        self.find(user_id, conversation_id)
            .await?
            .ok_or(ConversationError::NotFound)?;
        let page_len = match usize::try_from(limit) {
            Ok(0) | Err(_) => DEFAULT_PAGE_LEN,
            Ok(n) => n,
        };
        let mut query = message::Entity::find()
            .filter(message::Column::ConversationId.eq(conversation_id))
            .order_by_desc(message::Column::CreatedAt)
            .order_by_desc(message::Column::Id)
            .limit(page_len as u64 + 1);
        if let Some(before_id) = before_id {
            let Some(before) = message::Entity::find_by_id(before_id)
                .filter(message::Column::ConversationId.eq(conversation_id))
                .one(&self.db)
                .await?
            else {
                return Ok(MessagePage {
                    messages: Vec::new(),
                    has_more: false,
                });
            };
            query = query.filter(
                Expr::tuple([
                    Expr::col(message::Column::CreatedAt),
                    Expr::col(message::Column::Id),
                ])
                .lt(Expr::tuple([
                    Expr::value(before.created_at),
                    Expr::value(before.id),
                ])),
            );
        }
        let mut messages = query.all(&self.db).await?;
        let has_more = messages.len() > page_len;
        messages.truncate(page_len);
        Ok(MessagePage { messages, has_more })
    }
}
