use std::path::Path;
use std::sync::Arc;

use lemma_core::{ContentBlock, Message};
use lemma_session::{BoxStoreFuture, ConversationMeta, StoredMessage, TraceStore};
use parking_lot::Mutex;
use rusqlite::{Connection, params};
use uuid::Uuid;

use crate::error::SqliteStoreError;
use crate::schema::init_schema;

/// Thread-safe SQLite trace store implementation.
pub struct SqliteTraceStore {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteTraceStore {
    /// Opens an existing SQLite database file or creates it with initial schema.
    pub fn open(path: impl AsRef<Path>) -> Result<Self, SqliteStoreError> {
        let conn = Connection::open(path)?;
        init_schema(&conn)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    /// Creates an in-memory SQLite store (useful for tests).
    pub fn in_memory() -> Result<Self, SqliteStoreError> {
        let conn = Connection::open_in_memory()?;
        init_schema(&conn)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    /// Full-text search across all messages using the FTS5 index.
    pub fn search_history(
        &self,
        query: &str,
        limit: usize,
    ) -> Result<Vec<(Uuid, Uuid, String)>, SqliteStoreError> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(
            r#"
            SELECT message_id, conversation_id, text_content
            FROM messages_fts
            WHERE messages_fts MATCH ?
            LIMIT ?
            "#,
        )?;

        let rows = stmt.query_map(params![query, limit as i64], |row| {
            let msg_id_str: String = row.get(0)?;
            let conv_id_str: String = row.get(1)?;
            let text: String = row.get(2)?;
            Ok((msg_id_str, conv_id_str, text))
        })?;

        let mut results = Vec::new();
        for r in rows {
            let (m_str, c_str, text) = r?;
            if let (Ok(m_id), Ok(c_id)) = (Uuid::parse_str(&m_str), Uuid::parse_str(&c_str)) {
                results.push((m_id, c_id, text));
            }
        }
        Ok(results)
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
            let conn = self.conn.lock();
            let now = 0i64;
            conn.execute(
                r#"
                INSERT INTO conversations (id, title, leaf_id, local_only, created_at, updated_at)
                VALUES (?1, ?2, NULL, ?3, ?4, ?5)
                "#,
                params![
                    id.to_string(),
                    title,
                    if local_only { 1 } else { 0 },
                    now,
                    now
                ],
            )
            .map_err(SqliteStoreError::from)?;

            Ok(ConversationMeta {
                id,
                title,
                leaf_id: None,
                local_only,
                created_at: now,
                updated_at: now,
            })
        })
    }

    fn get_conversation<'a>(&'a self, id: Uuid) -> BoxStoreFuture<'a, Option<ConversationMeta>> {
        Box::pin(async move {
            let conn = self.conn.lock();
            let mut stmt = conn
                .prepare(
                    r#"
                    SELECT id, title, leaf_id, local_only, created_at, updated_at
                    FROM conversations
                    WHERE id = ?1
                    "#,
                )
                .map_err(SqliteStoreError::from)?;

            let mut rows = stmt
                .query_map(params![id.to_string()], |row| {
                    let id_str: String = row.get(0)?;
                    let title: String = row.get(1)?;
                    let leaf_str: Option<String> = row.get(2)?;
                    let local_only_int: i32 = row.get(3)?;
                    let created_at: i64 = row.get(4)?;
                    let updated_at: i64 = row.get(5)?;
                    Ok((
                        id_str,
                        title,
                        leaf_str,
                        local_only_int,
                        created_at,
                        updated_at,
                    ))
                })
                .map_err(SqliteStoreError::from)?;

            if let Some(res) = rows.next() {
                let (id_str, title, leaf_str, local_only_int, created_at, updated_at) =
                    res.map_err(SqliteStoreError::from)?;
                let conv_id = Uuid::parse_str(&id_str)
                    .map_err(|e| SqliteStoreError::Database(e.to_string()))?;
                let leaf_id = leaf_str.and_then(|s| Uuid::parse_str(&s).ok());

                Ok(Some(ConversationMeta {
                    id: conv_id,
                    title,
                    leaf_id,
                    local_only: local_only_int == 1,
                    created_at,
                    updated_at,
                }))
            } else {
                Ok(None)
            }
        })
    }

    fn update_leaf<'a>(&'a self, id: Uuid, leaf_id: Uuid) -> BoxStoreFuture<'a, ()> {
        Box::pin(async move {
            let conn = self.conn.lock();
            conn.execute(
                r#"
                UPDATE conversations
                SET leaf_id = ?1
                WHERE id = ?2
                "#,
                params![leaf_id.to_string(), id.to_string()],
            )
            .map_err(SqliteStoreError::from)?;
            Ok(())
        })
    }

    fn append_message<'a>(&'a self, entry: StoredMessage) -> BoxStoreFuture<'a, ()> {
        Box::pin(async move {
            let json_str = serde_json::to_string(&entry.message).map_err(SqliteStoreError::from)?;

            // Extract plain text for FTS5 index
            let text_extract = match &entry.message {
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

            let conn = self.conn.lock();
            conn.execute(
                r#"
                INSERT INTO messages (id, conversation_id, parent_id, content_json, created_at)
                VALUES (?1, ?2, ?3, ?4, ?5)
                "#,
                params![
                    entry.id.to_string(),
                    entry.conversation_id.to_string(),
                    entry.parent_id.map(|p| p.to_string()),
                    json_str,
                    entry.created_at
                ],
            )
            .map_err(SqliteStoreError::from)?;

            if !text_extract.is_empty() {
                let _ = conn.execute(
                    r#"
                    INSERT INTO messages_fts (message_id, conversation_id, text_content)
                    VALUES (?1, ?2, ?3)
                    "#,
                    params![
                        entry.id.to_string(),
                        entry.conversation_id.to_string(),
                        text_extract
                    ],
                );
            }

            Ok(())
        })
    }
    fn update_message<'a>(
        &'a self,
        id: Uuid,
        message: lemma_core::Message,
    ) -> BoxStoreFuture<'a, ()> {
        Box::pin(async move {
            let json_str = serde_json::to_string(&message).map_err(SqliteStoreError::from)?;
            let text_extract = match &message {
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

            let conn = self.conn.lock();
            conn.execute(
                r#"
                UPDATE messages
                SET content_json = ?1
                WHERE id = ?2
                "#,
                params![json_str, id.to_string()],
            )
            .map_err(SqliteStoreError::from)?;

            if !text_extract.is_empty() {
                let _ = conn.execute(
                    r#"
                    INSERT INTO messages_fts (message_id, conversation_id, text_content)
                    SELECT id, conversation_id, ?1 FROM messages WHERE id = ?2
                    "#,
                    params![text_extract, id.to_string()],
                );
            }

            Ok(())
        })
    }
    fn list_messages<'a>(
        &'a self,
        conversation_id: Uuid,
    ) -> BoxStoreFuture<'a, Vec<StoredMessage>> {
        Box::pin(async move {
            let conn = self.conn.lock();
            let mut stmt = conn
                .prepare(
                    r#"
                    SELECT id, conversation_id, parent_id, content_json, created_at
                    FROM messages
                    WHERE conversation_id = ?1
                    ORDER BY created_at ASC
                    "#,
                )
                .map_err(SqliteStoreError::from)?;

            let rows = stmt
                .query_map(params![conversation_id.to_string()], |row| {
                    let id_str: String = row.get(0)?;
                    let conv_str: String = row.get(1)?;
                    let parent_str: Option<String> = row.get(2)?;
                    let json_str: String = row.get(3)?;
                    let created_at: i64 = row.get(4)?;
                    Ok((id_str, conv_str, parent_str, json_str, created_at))
                })
                .map_err(SqliteStoreError::from)?;

            let mut list = Vec::new();
            for r in rows {
                let (id_str, conv_str, parent_str, json_str, created_at) =
                    r.map_err(SqliteStoreError::from)?;

                let id = Uuid::parse_str(&id_str)
                    .map_err(|e| SqliteStoreError::Database(e.to_string()))?;
                let conv_id = Uuid::parse_str(&conv_str)
                    .map_err(|e| SqliteStoreError::Database(e.to_string()))?;
                let parent_id = parent_str.and_then(|s| Uuid::parse_str(&s).ok());
                let message: Message =
                    serde_json::from_str(&json_str).map_err(SqliteStoreError::from)?;

                list.push(StoredMessage {
                    id,
                    conversation_id: conv_id,
                    parent_id,
                    message,
                    created_at,
                });
            }

            Ok(list)
        })
    }
}
