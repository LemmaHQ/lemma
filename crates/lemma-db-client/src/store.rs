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

    /// Exposes the underlying SQLite connection for atomic batch application.
    pub fn conn_handle(&self) -> Arc<parking_lot::Mutex<rusqlite::Connection>> {
        self.conn.clone()
    }

    /// Gets the current local synchronization cursor.
    pub fn get_sync_cursor(&self) -> Result<i64, SqliteStoreError> {
        let conn = self.conn.lock();
        let cursor: i64 = conn.query_row(
            "SELECT last_sync_seq FROM sync_state WHERE id = 1",
            [],
            |r| r.get(0),
        )?;
        Ok(cursor)
    }

    /// Advances the local synchronization cursor.
    pub fn update_sync_cursor(&self, seq: i64) -> Result<(), SqliteStoreError> {
        let conn = self.conn.lock();
        conn.execute(
            "UPDATE sync_state SET last_sync_seq = MAX(last_sync_seq, ?1), updated_at = 0 WHERE id = 1",
            params![seq],
        )?;
        Ok(())
    }

    /// Returns up to `limit` pending outbox items in FIFO order.
    pub fn list_outbox(
        &self,
        limit: usize,
    ) -> Result<Vec<crate::outbox::OutboxItem>, SqliteStoreError> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(
            r#"
            SELECT id, entity_type, entity_id, payload_json, created_at
            FROM outbox
            ORDER BY id ASC
            LIMIT ?1
            "#,
        )?;

        let rows = stmt.query_map(params![limit as i64], |row| {
            let id: i64 = row.get(0)?;
            let entity_type: String = row.get(1)?;
            let entity_id_str: String = row.get(2)?;
            let payload_json: String = row.get(3)?;
            let created_at: i64 = row.get(4)?;
            Ok((id, entity_type, entity_id_str, payload_json, created_at))
        })?;

        let mut items = Vec::new();
        for r in rows {
            let (id, entity_type, entity_id_str, payload_json, created_at) = r?;
            if let Ok(entity_id) = Uuid::parse_str(&entity_id_str) {
                items.push(crate::outbox::OutboxItem {
                    id,
                    entity_type,
                    entity_id,
                    payload_json,
                    created_at,
                });
            }
        }
        Ok(items)
    }

    /// Clears processed items from the outbox up to `max_id`.
    pub fn ack_outbox(&self, max_id: i64) -> Result<(), SqliteStoreError> {
        let conn = self.conn.lock();
        conn.execute("DELETE FROM outbox WHERE id <= ?1", params![max_id])?;
        Ok(())
    }

    /// Adds an item directly to the outbox.
    pub fn enqueue_outbox(
        &self,
        entity_type: &str,
        entity_id: Uuid,
        payload_json: &str,
    ) -> Result<(), SqliteStoreError> {
        let conn = self.conn.lock();
        conn.execute(
            r#"
            INSERT INTO outbox (entity_type, entity_id, payload_json, created_at)
            VALUES (?1, ?2, ?3, 0)
            "#,
            params![entity_type, entity_id.to_string(), payload_json],
        )?;
        Ok(())
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

            if !local_only {
                let _ = conn.execute(
                    r#"
                    INSERT INTO outbox (entity_type, entity_id, payload_json, created_at)
                    VALUES ('conversation', ?1, ?2, ?3)
                    "#,
                    params![id.to_string(), title, now],
                );
            }

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

            let _ = conn.execute(
                r#"
                INSERT INTO outbox (entity_type, entity_id, payload_json, created_at)
                SELECT 'message', ?1, ?2, ?3
                FROM conversations
                WHERE id = ?4 AND local_only = 0
                "#,
                params![
                    entry.id.to_string(),
                    json_str,
                    entry.created_at,
                    entry.conversation_id.to_string()
                ],
            );

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
