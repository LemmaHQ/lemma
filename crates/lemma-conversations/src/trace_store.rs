use lemma_core::{ContentBlock, Message, StopReason, TextContent};
use lemma_db_server::entity::{Conversation as DbConversation, Message as DbMessage};
use lemma_session::{BoxStoreFuture, ConversationMeta, SessionError, StoredMessage, TraceStore};
use sqlx::PgPool;
use uuid::Uuid;

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
                INSERT INTO conversations (id, user_id, title, leaf_id, status, created_at, updated_at)
                VALUES ($1, $2, $3, NULL, 'active', NOW(), NOW())
                RETURNING *
                "#,
            )
            .bind(id)
            .bind(self.user_id)
            .bind(title.clone())
            .fetch_one(&self.pool)
            .await
            .map_err(|e| SessionError::Store(e.to_string()))?;

            Ok(ConversationMeta {
                id: row.id,
                title: row.title,
                leaf_id: row.leaf_id,
                local_only,
                created_at: row.created_at.timestamp_millis(),
                updated_at: row.updated_at.timestamp_millis(),
            })
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

            Ok(opt.map(|row| ConversationMeta {
                id: row.id,
                title: row.title,
                leaf_id: row.leaf_id,
                local_only: false,
                created_at: row.created_at.timestamp_millis(),
                updated_at: row.updated_at.timestamp_millis(),
            }))
        })
    }

    fn update_leaf<'a>(&'a self, id: Uuid, leaf_id: Uuid) -> BoxStoreFuture<'a, ()> {
        Box::pin(async move {
            sqlx::query(
                r#"
                UPDATE conversations
                SET leaf_id = $1, updated_at = NOW(), sync_seq = nextval('sync_seq')
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

    fn update_message<'a>(
        &'a self,
        id: Uuid,
        message: lemma_core::Message,
    ) -> BoxStoreFuture<'a, ()> {
        Box::pin(async move {
            let text = match &message {
                Message::User { content } | Message::Assistant { content, .. } => content
                    .iter()
                    .filter_map(|b| match b {
                        ContentBlock::Text(t) => Some(t.text.as_str()),
                        _ => None,
                    })
                    .collect::<Vec<_>>()
                    .join(" "),
                _ => String::new(),
            };

            sqlx::query(
                r#"
                UPDATE messages
                SET content = $1, status = 'done', updated_at = NOW(), sync_seq = nextval('sync_seq')
                WHERE id = $2
                "#,
            )
            .bind(text)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| SessionError::Store(e.to_string()))?;

            Ok(())
        })
    }

    fn append_message<'a>(&'a self, entry: StoredMessage) -> BoxStoreFuture<'a, ()> {
        Box::pin(async move {
            let (role, text) = match &entry.message {
                Message::User { content } => {
                    let t = content
                        .iter()
                        .filter_map(|b| match b {
                            ContentBlock::Text(t) => Some(t.text.as_str()),
                            _ => None,
                        })
                        .collect::<Vec<_>>()
                        .join(" ");
                    ("user", t)
                }
                Message::Assistant { content, .. } => {
                    let t = content
                        .iter()
                        .filter_map(|b| match b {
                            ContentBlock::Text(t) => Some(t.text.as_str()),
                            _ => None,
                        })
                        .collect::<Vec<_>>()
                        .join(" ");
                    ("assistant", t)
                }
                _ => ("system", String::new()),
            };

            sqlx::query(
                r#"
                INSERT INTO messages (id, conversation_id, parent_id, role, content, status, seq, sync_seq, created_at, updated_at)
                VALUES (
                    $1, $2, $3, $4, $5, 'done',
                    COALESCE((SELECT MAX(seq) + 1 FROM messages WHERE conversation_id = $2), 1),
                    nextval('sync_seq'), NOW(), NOW()
                )
                "#,
            )
            .bind(entry.id)
            .bind(entry.conversation_id)
            .bind(entry.parent_id)
            .bind(role)
            .bind(text)
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
                ORDER BY seq ASC
                "#,
            )
            .bind(conversation_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| SessionError::Store(e.to_string()))?;

            let entries = rows
                .into_iter()
                .map(|r| {
                    let block = ContentBlock::Text(TextContent {
                        text: r.content.clone(),
                    });
                    let message = if r.role == "user" {
                        Message::User {
                            content: vec![block],
                        }
                    } else {
                        Message::Assistant {
                            content: vec![block],
                            stop_reason: StopReason::Stop,
                            usage: None,
                        }
                    };

                    StoredMessage {
                        id: r.id,
                        conversation_id: r.conversation_id,
                        parent_id: r.parent_id,
                        message,
                        created_at: r.created_at.timestamp_millis(),
                    }
                })
                .collect();

            Ok(entries)
        })
    }
}
