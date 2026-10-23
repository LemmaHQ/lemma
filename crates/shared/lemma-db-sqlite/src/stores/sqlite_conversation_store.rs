//! `ConversationStore` implementation over the conversations and messages
//! tables.

use chrono::{DateTime, Utc};
use lemma_conversation::{
    Conversation, ConversationError, ConversationStore, LastModel, Message, MessagePage,
    MessageStatus, MessageUpdate,
};
use sqlx::SqlitePool;
use sqlx::types::Json;
use uuid::Uuid;

use crate::clock;
use crate::entity;
use crate::queries::conversations;

fn timestamp(ms: i64) -> Result<DateTime<Utc>, ConversationError> {
    DateTime::from_timestamp_millis(ms)
        .ok_or_else(|| ConversationError::Store(format!("timestamp out of range: {ms}")))
}

fn status_parse(status: &str) -> MessageStatus {
    match status {
        "streaming" => MessageStatus::Streaming,
        "error" => MessageStatus::Error,
        "aborted" => MessageStatus::Aborted,
        _ => MessageStatus::Done,
    }
}

fn into_conversation(c: entity::Conversation) -> Result<Conversation, ConversationError> {
    Ok(Conversation {
        id: c.id,
        user_id: c.user_id,
        title: c.title,
        leaf_id: c.leaf_id,
        last_model: c.last_model.map(|Json(m)| m),
        created_at: timestamp(c.created_at)?,
        updated_at: timestamp(c.updated_at)?,
    })
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
        created_at: timestamp(m.created_at)?,
        updated_at: timestamp(m.updated_at)?,
    })
}

fn content_json(
    message: &lemma_core::Message,
) -> Result<Json<serde_json::Value>, ConversationError> {
    serde_json::to_value(message)
        .map(Json)
        .map_err(|e| ConversationError::Store(format!("serialize message: {e}")))
}

#[expect(clippy::needless_pass_by_value, reason = "used as a map_err function")]
fn store_err(e: sqlx::Error) -> ConversationError {
    ConversationError::Store(e.to_string())
}

/// [`ConversationStore`] backed by a SQLite pool.
#[derive(Debug, Clone)]
pub struct SqliteConversationStore {
    pool: SqlitePool,
}

impl SqliteConversationStore {
    /// Creates the store over a pool.
    #[must_use]
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

impl ConversationStore for SqliteConversationStore {
    async fn insert(&self, user_id: Uuid) -> Result<Conversation, ConversationError> {
        conversations::insert(&self.pool, user_id)
            .await
            .map_err(store_err)
            .and_then(into_conversation)
    }

    async fn list_by_user(&self, user_id: Uuid) -> Result<Vec<Conversation>, ConversationError> {
        conversations::list_by_user(&self.pool, user_id)
            .await
            .map_err(store_err)?
            .into_iter()
            .map(into_conversation)
            .collect()
    }

    async fn find_by_id_and_user(
        &self,
        id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<Conversation>, ConversationError> {
        conversations::find_by_id_and_user(&self.pool, id, user_id)
            .await
            .map_err(store_err)?
            .map(into_conversation)
            .transpose()
    }

    async fn rename(
        &self,
        id: Uuid,
        user_id: Uuid,
        title: &str,
    ) -> Result<Option<Conversation>, ConversationError> {
        conversations::rename(&self.pool, id, user_id, title)
            .await
            .map_err(store_err)?
            .map(into_conversation)
            .transpose()
    }

    async fn delete(&self, id: Uuid, user_id: Uuid) -> Result<bool, ConversationError> {
        conversations::delete(&self.pool, id, user_id)
            .await
            .map_err(store_err)
    }

    async fn update_leaf(
        &self,
        id: Uuid,
        user_id: Uuid,
        leaf_id: Uuid,
    ) -> Result<(), ConversationError> {
        sqlx::query(
            r#"
            UPDATE conversations
            SET leaf_id = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
            "#,
        )
        .bind(leaf_id)
        .bind(clock::now_ms())
        .bind(id)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(store_err)?;
        Ok(())
    }

    async fn update_last_model(
        &self,
        id: Uuid,
        user_id: Uuid,
        last_model: &LastModel,
    ) -> Result<(), ConversationError> {
        sqlx::query(
            r#"
            UPDATE conversations
            SET last_model = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
            "#,
        )
        .bind(Json(last_model))
        .bind(clock::now_ms())
        .bind(id)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(store_err)?;
        Ok(())
    }

    async fn append_message(&self, entry: &Message) -> Result<(), ConversationError> {
        sqlx::query(
            r#"
            INSERT INTO messages (id, conversation_id, parent_id, role, content_json, model,
                                  provider_id, status, error, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(entry.id)
        .bind(entry.conversation_id)
        .bind(entry.parent_id)
        .bind(entry.role())
        .bind(content_json(&entry.message)?)
        .bind(&entry.model)
        .bind(entry.provider_id)
        .bind(entry.status.as_str())
        .bind(&entry.error)
        .bind(entry.created_at.timestamp_millis())
        .bind(clock::now_ms())
        .execute(&self.pool)
        .await
        .map_err(store_err)?;
        Ok(())
    }

    async fn update_message(
        &self,
        id: Uuid,
        update: &MessageUpdate,
    ) -> Result<(), ConversationError> {
        sqlx::query(
            r#"
            UPDATE messages
            SET content_json = ?, status = ?, error = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(content_json(&update.message)?)
        .bind(update.status.as_str())
        .bind(&update.error)
        .bind(clock::now_ms())
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(store_err)?;
        Ok(())
    }

    async fn list_messages(
        &self,
        conversation_id: Uuid,
    ) -> Result<Vec<Message>, ConversationError> {
        let rows = sqlx::query_as::<_, entity::Message>(
            r#"
            SELECT * FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC, id ASC
            "#,
        )
        .bind(conversation_id)
        .fetch_all(&self.pool)
        .await
        .map_err(store_err)?;
        rows.into_iter().map(into_message).collect()
    }

    async fn list_messages_page(
        &self,
        conversation_id: Uuid,
        before_id: Option<Uuid>,
        limit: i64,
    ) -> Result<MessagePage, ConversationError> {
        let page = conversations::list_messages(&self.pool, conversation_id, before_id, limit)
            .await
            .map_err(store_err)?;
        let messages = page
            .messages
            .into_iter()
            .map(into_message)
            .collect::<Result<Vec<_>, _>>()?;
        Ok(MessagePage {
            messages,
            has_more: page.has_more,
        })
    }
}
