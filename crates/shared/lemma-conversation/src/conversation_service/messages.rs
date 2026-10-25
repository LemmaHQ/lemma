use chrono::Utc;
use sea_orm::sea_query::{Expr, ExprTrait};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect, Set};
use uuid::Uuid;

use crate::Message;
use crate::conversation_error::ConversationError;
use crate::entity::message;

use super::conversations::ConversationService;
use super::message_page::MessagePage;
use super::message_update::MessageUpdate;

const DEFAULT_PAGE_LEN: usize = 50;

impl ConversationService {
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
