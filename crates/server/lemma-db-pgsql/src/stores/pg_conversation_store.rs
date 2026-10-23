//! `ConversationStore` implementation over the conversations and messages
//! tables.

use uuid::Uuid;

use lemma_conversation::{
    BoxConversationFuture, Conversation, ConversationError, ConversationStore, LastModel, Message,
    MessageStatus, MessageUpdate,
};
use sqlx::types::Json;

use crate::entity;
use crate::queries::conversations;

fn status_parse(status: &str) -> MessageStatus {
    match status {
        "streaming" => MessageStatus::Streaming,
        "aborted" => MessageStatus::Aborted,
        "error" => MessageStatus::Error,
        _ => MessageStatus::Done,
    }
}

fn into_conversation(c: entity::Conversation) -> Conversation {
    Conversation {
        id: c.id,
        user_id: c.user_id,
        title: c.title,
        leaf_id: c.leaf_id,
        last_model: c.last_model.map(|Json(m)| m),
        created_at: c.created_at,
        updated_at: c.updated_at,
    }
}

fn into_message(m: entity::Message) -> Result<Message, ConversationError> {
    let message = serde_json::from_value(m.content_json.0)
        .map_err(|e| ConversationError::Store(format!("bad content_json: {e}")))?;
    Ok(Message {
        id: m.id,
        conversation_id: m.conversation_id,
        parent_id: m.parent_id,
        message,
        status: status_parse(&m.status),
        error: m.error,
        provider_id: m.provider_id,
        model: m.model,
        created_at: m.created_at,
        updated_at: m.updated_at,
    })
}

fn store_err(e: sqlx::Error) -> ConversationError {
    ConversationError::Store(e.to_string())
}

/// [`ConversationStore`] backed by a PostgreSQL pool.
pub struct PgConversationStore {
    pool: sqlx::PgPool,
}

impl PgConversationStore {
    /// Creates the store over a pool.
    pub fn new(pool: sqlx::PgPool) -> Self {
        Self { pool }
    }
}

impl ConversationStore for PgConversationStore {
    fn insert<'a>(&'a self, user_id: Uuid) -> BoxConversationFuture<'a, Conversation> {
        Box::pin(async move {
            conversations::insert(&self.pool, user_id)
                .await
                .map(into_conversation)
                .map_err(store_err)
        })
    }

    fn list_by_user<'a>(&'a self, user_id: Uuid) -> BoxConversationFuture<'a, Vec<Conversation>> {
        Box::pin(async move {
            conversations::list_by_user(&self.pool, user_id)
                .await
                .map(|rows| rows.into_iter().map(into_conversation).collect())
                .map_err(store_err)
        })
    }

    fn find_by_id_and_user<'a>(
        &'a self,
        id: Uuid,
        user_id: Uuid,
    ) -> BoxConversationFuture<'a, Option<Conversation>> {
        Box::pin(async move {
            conversations::find_by_id_and_user(&self.pool, id, user_id)
                .await
                .map(|row| row.map(into_conversation))
                .map_err(store_err)
        })
    }

    fn rename<'a>(
        &'a self,
        id: Uuid,
        user_id: Uuid,
        title: &'a str,
    ) -> BoxConversationFuture<'a, Option<Conversation>> {
        Box::pin(async move {
            conversations::rename(&self.pool, id, user_id, title)
                .await
                .map(|row| row.map(into_conversation))
                .map_err(store_err)
        })
    }

    fn delete<'a>(&'a self, id: Uuid, user_id: Uuid) -> BoxConversationFuture<'a, bool> {
        Box::pin(async move {
            conversations::delete(&self.pool, id, user_id)
                .await
                .map_err(store_err)
        })
    }

    fn update_leaf<'a>(
        &'a self,
        id: Uuid,
        user_id: Uuid,
        leaf_id: Uuid,
    ) -> BoxConversationFuture<'a, ()> {
        Box::pin(async move {
            sqlx::query(
                r#"
                UPDATE conversations
                SET leaf_id = $1, updated_at = NOW()
                WHERE id = $2 AND user_id = $3
                "#,
            )
            .bind(leaf_id)
            .bind(id)
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(store_err)?;

            Ok(())
        })
    }

    fn update_last_model<'a>(
        &'a self,
        id: Uuid,
        user_id: Uuid,
        last_model: LastModel,
    ) -> BoxConversationFuture<'a, ()> {
        Box::pin(async move {
            sqlx::query(
                r#"
                UPDATE conversations
                SET last_model = $1, updated_at = NOW()
                WHERE id = $2 AND user_id = $3
                "#,
            )
            .bind(Json(last_model))
            .bind(id)
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(store_err)?;

            Ok(())
        })
    }

    fn append_message<'a>(&'a self, entry: Message) -> BoxConversationFuture<'a, ()> {
        Box::pin(async move {
            let content = serde_json::to_value(&entry.message)
                .map_err(|e| ConversationError::Store(format!("serialize message: {e}")))?;

            sqlx::query(
                r#"
                INSERT INTO messages (id, conversation_id, parent_id, role, content_json, model,
                                      provider_id, status, error, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
                "#,
            )
            .bind(entry.id)
            .bind(entry.conversation_id)
            .bind(entry.parent_id)
            .bind(entry.role())
            .bind(Json(content))
            .bind(&entry.model)
            .bind(entry.provider_id)
            .bind(entry.status.as_str())
            .bind(&entry.error)
            .bind(entry.created_at)
            .execute(&self.pool)
            .await
            .map_err(store_err)?;

            Ok(())
        })
    }

    fn update_message<'a>(
        &'a self,
        id: Uuid,
        update: MessageUpdate,
    ) -> BoxConversationFuture<'a, ()> {
        Box::pin(async move {
            let content = serde_json::to_value(&update.message)
                .map_err(|e| ConversationError::Store(format!("serialize message: {e}")))?;

            sqlx::query(
                r#"
                UPDATE messages
                SET content_json = $1, status = $2, error = $3, updated_at = NOW()
                WHERE id = $4
                "#,
            )
            .bind(Json(content))
            .bind(update.status.as_str())
            .bind(update.error)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(store_err)?;

            Ok(())
        })
    }

    fn list_messages<'a>(
        &'a self,
        conversation_id: Uuid,
    ) -> BoxConversationFuture<'a, Vec<Message>> {
        Box::pin(async move {
            let rows = sqlx::query_as::<_, entity::Message>(
                r#"
                SELECT * FROM messages
                WHERE conversation_id = $1
                ORDER BY created_at, id
                "#,
            )
            .bind(conversation_id)
            .fetch_all(&self.pool)
            .await
            .map_err(store_err)?;

            rows.into_iter().map(into_message).collect()
        })
    }

    fn list_messages_page<'a>(
        &'a self,
        conversation_id: Uuid,
        before_id: Option<Uuid>,
        limit: i64,
    ) -> BoxConversationFuture<'a, (Vec<Message>, bool)> {
        Box::pin(async move {
            let (rows, has_more) =
                conversations::list_messages(&self.pool, conversation_id, before_id, limit)
                    .await
                    .map_err(store_err)?;
            let messages = rows
                .into_iter()
                .map(into_message)
                .collect::<Result<Vec<_>, _>>()?;
            Ok((messages, has_more))
        })
    }
}
