//! `TraceStore` implementation over the conversations and messages tables.

use chrono::{DateTime, Utc};
use lemma_core::Message;
use lemma_session::{
    BoxStoreFuture, ConversationMeta, LastModel, MessageStatus, MessageUpdate, SessionError,
    StoredMessage, TraceStore,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::entity::{
    Conversation as DbConversation, LastModel as DbLastModel, Message as DbMessage,
    TokenUsage as DbTokenUsage,
};

/// PostgreSQL implementation of the canonical `TraceStore`.
pub struct PgTraceStore {
    pool: PgPool,
    user_id: Uuid,
}

impl PgTraceStore {
    /// Creates a new Postgres trace store bound to a specific user context.
    pub fn new(pool: PgPool, user_id: Uuid) -> Self {
        Self { pool, user_id }
    }
}

fn meta_from_row(row: DbConversation) -> ConversationMeta {
    ConversationMeta {
        id: row.id,
        title: row.title,
        leaf_id: row.leaf_id,
        local_only: row.local_only,
        last_model: row.last_model.map(|j| LastModel {
            provider_id: j.0.provider_id,
            model: j.0.model,
            thinking_effort: j.0.thinking_effort,
        }),
        created_at: row.created_at.timestamp_millis(),
        updated_at: row.updated_at.timestamp_millis(),
    }
}

fn status_str(status: MessageStatus) -> &'static str {
    match status {
        MessageStatus::Streaming => "streaming",
        MessageStatus::Done => "done",
        MessageStatus::Aborted => "aborted",
        MessageStatus::Error => "error",
    }
}

fn status_parse(status: &str) -> MessageStatus {
    match status {
        "streaming" => MessageStatus::Streaming,
        "aborted" => MessageStatus::Aborted,
        "error" => MessageStatus::Error,
        _ => MessageStatus::Done,
    }
}

fn ms_to_dt(ms: i64) -> DateTime<Utc> {
    DateTime::from_timestamp_millis(ms).unwrap_or(DateTime::UNIX_EPOCH)
}

fn stored_from_row(r: DbMessage) -> Result<StoredMessage, SessionError> {
    let message: Message = serde_json::from_value(r.content_json.0)
        .map_err(|e| SessionError::Store(format!("bad content_json: {e}")))?;
    Ok(StoredMessage {
        id: r.id,
        conversation_id: r.conversation_id,
        parent_id: r.parent_id,
        message,
        status: status_parse(&r.status),
        model: r.model,
        provider_id: r.provider_id,
        started_at: r.started_at.map_or(0, |t| t.timestamp_millis()),
        created_at: r.created_at.timestamp_millis(),
    })
}

impl TraceStore for PgTraceStore {
    fn create_conversation<'a>(
        &'a self,
        id: Uuid,
        title: String,
        local_only: bool,
    ) -> BoxStoreFuture<'a, ConversationMeta> {
        Box::pin(async move {
            let row = sqlx::query_as::<_, DbConversation>(
                r#"
                INSERT INTO conversations (id, user_id, title, leaf_id, status, local_only, created_at, updated_at)
                VALUES ($1, $2, $3, NULL, 'active', $4, NOW(), NOW())
                RETURNING *
                "#,
            )
            .bind(id)
            .bind(self.user_id)
            .bind(title)
            .bind(local_only)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| SessionError::Store(e.to_string()))?;

            Ok(meta_from_row(row))
        })
    }

    fn get_conversation<'a>(&'a self, id: Uuid) -> BoxStoreFuture<'a, Option<ConversationMeta>> {
        Box::pin(async move {
            let opt = sqlx::query_as::<_, DbConversation>(
                r#"
                SELECT * FROM conversations
                WHERE id = $1 AND user_id = $2
                "#,
            )
            .bind(id)
            .bind(self.user_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| SessionError::Store(e.to_string()))?;

            Ok(opt.map(meta_from_row))
        })
    }

    fn update_leaf<'a>(&'a self, id: Uuid, leaf_id: Uuid) -> BoxStoreFuture<'a, ()> {
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
            .bind(self.user_id)
            .execute(&self.pool)
            .await
            .map_err(|e| SessionError::Store(e.to_string()))?;

            Ok(())
        })
    }

    fn update_message<'a>(&'a self, id: Uuid, update: MessageUpdate) -> BoxStoreFuture<'a, ()> {
        Box::pin(async move {
            let usage = match &update.message {
                Message::Assistant { usage, .. } => *usage,
                _ => None,
            };
            let content = serde_json::to_value(&update.message)
                .map_err(|e| SessionError::Store(format!("serialize message: {e}")))?;

            sqlx::query(
                r#"
                UPDATE messages
                SET content_json = $1, status = $2, token_usage = $3,
                    first_token_at = $4, finished_at = $5, updated_at = NOW()
                WHERE id = $6
                "#,
            )
            .bind(sqlx::types::Json(content))
            .bind(status_str(update.status))
            .bind(usage.map(|u| {
                sqlx::types::Json(DbTokenUsage {
                    input: u.input,
                    output: u.output,
                    cache_read: u.cache_read,
                    cache_write: u.cache_write,
                })
            }))
            .bind(update.first_token_at.map(ms_to_dt))
            .bind(ms_to_dt(update.finished_at))
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| SessionError::Store(e.to_string()))?;

            Ok(())
        })
    }

    fn update_conversation_model<'a>(
        &'a self,
        id: Uuid,
        last_model: LastModel,
    ) -> BoxStoreFuture<'a, ()> {
        Box::pin(async move {
            sqlx::query(
                r#"
                UPDATE conversations
                SET last_model = $1, updated_at = NOW()
                WHERE id = $2 AND user_id = $3
                "#,
            )
            .bind(sqlx::types::Json(DbLastModel {
                provider_id: last_model.provider_id,
                model: last_model.model,
                thinking_effort: last_model.thinking_effort,
            }))
            .bind(id)
            .bind(self.user_id)
            .execute(&self.pool)
            .await
            .map_err(|e| SessionError::Store(e.to_string()))?;

            Ok(())
        })
    }

    fn append_message<'a>(&'a self, entry: StoredMessage) -> BoxStoreFuture<'a, ()> {
        Box::pin(async move {
            let (role, usage) = match &entry.message {
                Message::User { .. } => ("user", None),
                Message::Assistant { usage, .. } => ("assistant", *usage),
                Message::ToolResult { .. } => ("tool", None),
            };
            let content = serde_json::to_value(&entry.message)
                .map_err(|e| SessionError::Store(format!("serialize message: {e}")))?;
            let created = ms_to_dt(entry.created_at);

            sqlx::query(
                r#"
                INSERT INTO messages (id, conversation_id, parent_id, role, content_json, model,
                                      provider_id, status, token_usage, started_at, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
                "#,
            )
            .bind(entry.id)
            .bind(entry.conversation_id)
            .bind(entry.parent_id)
            .bind(role)
            .bind(sqlx::types::Json(content))
            .bind(&entry.model)
            .bind(entry.provider_id)
            .bind(status_str(entry.status))
            .bind(usage.map(|u| {
                sqlx::types::Json(DbTokenUsage {
                    input: u.input,
                    output: u.output,
                    cache_read: u.cache_read,
                    cache_write: u.cache_write,
                })
            }))
            .bind(ms_to_dt(entry.started_at))
            .bind(created)
            .execute(&self.pool)
            .await
            .map_err(|e| SessionError::Store(e.to_string()))?;

            Ok(())
        })
    }

    fn list_messages<'a>(
        &'a self,
        conversation_id: Uuid,
    ) -> BoxStoreFuture<'a, Vec<StoredMessage>> {
        Box::pin(async move {
            let rows = sqlx::query_as::<_, DbMessage>(
                r#"
                SELECT * FROM messages
                WHERE conversation_id = $1
                ORDER BY created_at, id
                "#,
            )
            .bind(conversation_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| SessionError::Store(e.to_string()))?;

            rows.into_iter().map(stored_from_row).collect()
        })
    }
}
