use chrono::Utc;
use sea_orm::sea_query::{Expr, ExprTrait};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect, Set};
use uuid::Uuid;

use crate::Message;
use crate::entity::message;
use crate::session_error::SessionError;

use super::message_page::MessagePage;
use super::message_update::MessageUpdate;
use super::sessions::SessionService;

const DEFAULT_PAGE_LEN: usize = 50;

impl SessionService {
    /// Appends a new message node into the tree.
    ///
    /// # Errors
    ///
    /// [`SessionError::Store`] when the database fails, including a
    /// session that does not exist.
    pub async fn append_message(&self, entry: Message) -> Result<(), SessionError> {
        message::Entity::insert(message::ActiveModel::from(entry))
            .exec_without_returning(&self.db)
            .await?;
        Ok(())
    }

    /// Finalizes a placeholder message with its settled body and status.
    ///
    /// # Errors
    ///
    /// [`SessionError::Store`] when the database fails.
    pub async fn update_message(
        &self,
        id: Uuid,
        update: MessageUpdate,
    ) -> Result<(), SessionError> {
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

    /// Retrieves every message of a session, oldest first.
    ///
    /// # Errors
    ///
    /// [`SessionError::Store`] when the database fails.
    pub async fn all_messages(&self, session_id: Uuid) -> Result<Vec<Message>, SessionError> {
        Ok(message::Entity::find()
            .filter(message::Column::SessionId.eq(session_id))
            .order_by_asc(message::Column::CreatedAt)
            .order_by_asc(message::Column::Id)
            .all(&self.db)
            .await?)
    }

    /// Lists a session's messages newest-first with keyset
    /// pagination: `before_id` selects messages older than that message,
    /// and an unknown `before_id` yields an empty page. A `limit` that is
    /// not positive, as when the request omits it, returns 50 messages.
    ///
    /// # Errors
    ///
    /// [`SessionError::NotFound`] when the user owns no such
    /// session and [`SessionError::Store`] when the database
    /// fails.
    pub async fn list_messages(
        &self,
        user_id: Uuid,
        session_id: Uuid,
        before_id: Option<Uuid>,
        limit: i32,
    ) -> Result<MessagePage, SessionError> {
        self.find(user_id, session_id)
            .await?
            .ok_or(SessionError::NotFound)?;
        let page_len = match usize::try_from(limit) {
            Ok(0) | Err(_) => DEFAULT_PAGE_LEN,
            Ok(n) => n,
        };
        let mut query = message::Entity::find()
            .filter(message::Column::SessionId.eq(session_id))
            .order_by_desc(message::Column::CreatedAt)
            .order_by_desc(message::Column::Id)
            .limit(page_len as u64 + 1);
        if let Some(before_id) = before_id {
            let Some(before) = message::Entity::find_by_id(before_id)
                .filter(message::Column::SessionId.eq(session_id))
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
