//! `TraceStore` implementation over the conversations and messages tables.

use lemma_core::Message;
use lemma_session::{
    BoxStoreFuture, ConversationMeta, LastModel, MessageStatus, MessageUpdate, StoredMessage,
    TraceStore,
};
use sqlx::SqlitePool;
use sqlx::types::Json;
use uuid::Uuid;

use crate::entity;
use crate::error::SqliteStoreError;
use crate::now_ms;

/// SQLite trace store over a shared connection pool, bound to the local
/// account.
#[derive(Clone)]
pub struct SqliteTraceStore {
    pool: SqlitePool,
    user_id: Uuid,
}

impl SqliteTraceStore {
    /// Wraps a migrated pool, scoped to the given account.
    pub fn new(pool: SqlitePool, user_id: Uuid) -> Self {
        Self { pool, user_id }
    }
}

fn status_str(status: MessageStatus) -> &'static str {
    match status {
        MessageStatus::Streaming => "streaming",
        MessageStatus::Done => "done",
        MessageStatus::Error => "error",
        MessageStatus::Aborted => "aborted",
    }
}

fn status_parse(status: &str) -> MessageStatus {
    match status {
        "streaming" => MessageStatus::Streaming,
        "error" => MessageStatus::Error,
        "aborted" => MessageStatus::Aborted,
        _ => MessageStatus::Done,
    }
}

fn role_of(message: &Message) -> &'static str {
    match message {
        Message::User { .. } => "user",
        Message::Assistant { .. } => "assistant",
        Message::ToolResult { .. } => "tool",
    }
}

fn meta_of(row: entity::Conversation) -> ConversationMeta {
    ConversationMeta {
        id: row.id,
        title: row.title,
        leaf_id: row.leaf_id,
        local_only: row.local_only,
        last_model: row.last_model.map(|Json(m)| LastModel {
            provider_id: m.provider_id,
            model: m.model,
            thinking_effort: m.thinking_effort,
        }),
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

fn stored_of(row: entity::Message) -> Result<StoredMessage, SqliteStoreError> {
    let message: Message = serde_json::from_value(row.content_json.0)?;
    Ok(StoredMessage {
        id: row.id,
        conversation_id: row.conversation_id,
        parent_id: row.parent_id,
        message,
        status: status_parse(&row.status),
        model: row.model,
        provider_id: row.provider_id,
        started_at: row.started_at.unwrap_or(0),
        created_at: row.created_at,
    })
}

fn usage_of(message: &Message) -> Option<Json<entity::TokenUsage>> {
    match message {
        Message::Assistant { usage: Some(u), .. } => Some(Json(entity::TokenUsage {
            input: u.input,
            output: u.output,
            cache_read: u.cache_read,
            cache_write: u.cache_write,
        })),
        _ => None,
    }
}

impl TraceStore for SqliteTraceStore {
    fn create_conversation<'a>(
        &'a self,
        id: Uuid,
        title: String,
        local_only: bool,
    ) -> BoxStoreFuture<'a, ConversationMeta> {
        Box::pin(async move {
            let now = now_ms();
            let row = sqlx::query_as::<_, entity::Conversation>(
                r#"
                INSERT INTO conversations (id, user_id, title, leaf_id, status, local_only, created_at, updated_at)
                VALUES (?, ?, ?, NULL, 'active', ?, ?, ?)
                RETURNING *
                "#,
            )
            .bind(id)
            .bind(self.user_id)
            .bind(&title)
            .bind(local_only)
            .bind(now)
            .bind(now)
            .fetch_one(&self.pool)
            .await
            .map_err(SqliteStoreError::from)?;

            Ok(meta_of(row))
        })
    }

    fn get_conversation<'a>(&'a self, id: Uuid) -> BoxStoreFuture<'a, Option<ConversationMeta>> {
        Box::pin(async move {
            let row = sqlx::query_as::<_, entity::Conversation>(
                r#"
                SELECT * FROM conversations
                WHERE id = ? AND user_id = ?
                "#,
            )
            .bind(id)
            .bind(self.user_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(SqliteStoreError::from)?;

            Ok(row.map(meta_of))
        })
    }

    fn update_leaf<'a>(&'a self, id: Uuid, leaf_id: Uuid) -> BoxStoreFuture<'a, ()> {
        Box::pin(async move {
            sqlx::query(
                r#"
                UPDATE conversations
                SET leaf_id = ?, updated_at = ?
                WHERE id = ? AND user_id = ?
                "#,
            )
            .bind(leaf_id)
            .bind(now_ms())
            .bind(id)
            .bind(self.user_id)
            .execute(&self.pool)
            .await
            .map_err(SqliteStoreError::from)?;
            Ok(())
        })
    }

    fn update_conversation_model<'a>(
        &'a self,
        id: Uuid,
        last_model: LastModel,
    ) -> BoxStoreFuture<'a, ()> {
        Box::pin(async move {
            let json = Json(entity::LastModel {
                provider_id: last_model.provider_id,
                model: last_model.model,
                thinking_effort: last_model.thinking_effort,
            });
            sqlx::query(
                r#"
                UPDATE conversations
                SET last_model = ?, updated_at = ?
                WHERE id = ? AND user_id = ?
                "#,
            )
            .bind(json)
            .bind(now_ms())
            .bind(id)
            .bind(self.user_id)
            .execute(&self.pool)
            .await
            .map_err(SqliteStoreError::from)?;
            Ok(())
        })
    }

    fn append_message<'a>(&'a self, entry: StoredMessage) -> BoxStoreFuture<'a, ()> {
        Box::pin(async move {
            let content =
                Json(serde_json::to_value(&entry.message).map_err(SqliteStoreError::from)?);
            let usage = usage_of(&entry.message);
            let now = now_ms();

            sqlx::query(
                r#"
                INSERT INTO messages (id, conversation_id, parent_id, role, content_json, model,
                                      provider_id, status, token_usage, started_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(entry.id)
            .bind(entry.conversation_id)
            .bind(entry.parent_id)
            .bind(role_of(&entry.message))
            .bind(content)
            .bind(entry.model)
            .bind(entry.provider_id)
            .bind(status_str(entry.status))
            .bind(usage)
            .bind(entry.started_at)
            .bind(entry.created_at)
            .bind(now)
            .execute(&self.pool)
            .await
            .map_err(SqliteStoreError::from)?;

            Ok(())
        })
    }

    fn update_message<'a>(&'a self, id: Uuid, update: MessageUpdate) -> BoxStoreFuture<'a, ()> {
        Box::pin(async move {
            let content =
                Json(serde_json::to_value(&update.message).map_err(SqliteStoreError::from)?);
            let usage = usage_of(&update.message);

            sqlx::query(
                r#"
                UPDATE messages
                SET content_json = ?, status = ?, token_usage = ?,
                    first_token_at = ?, finished_at = ?, updated_at = ?
                WHERE id = ?
                "#,
            )
            .bind(content)
            .bind(status_str(update.status))
            .bind(usage)
            .bind(update.first_token_at)
            .bind(update.finished_at)
            .bind(now_ms())
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(SqliteStoreError::from)?;

            Ok(())
        })
    }

    fn list_messages<'a>(
        &'a self,
        conversation_id: Uuid,
    ) -> BoxStoreFuture<'a, Vec<StoredMessage>> {
        Box::pin(async move {
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
            .map_err(SqliteStoreError::from)?;

            let messages = rows
                .into_iter()
                .map(stored_of)
                .collect::<Result<Vec<_>, SqliteStoreError>>()?;
            Ok(messages)
        })
    }
}
