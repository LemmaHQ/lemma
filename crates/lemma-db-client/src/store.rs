use std::path::Path;
use std::sync::Arc;

use lemma_core::Message;
use lemma_session::{
    BoxStoreFuture, ConversationMeta, LastModel, MessageStatus, MessageUpdate, StoredMessage,
    TraceStore,
};
use parking_lot::Mutex;
use rusqlite::{Connection, params};
use uuid::Uuid;

use crate::error::SqliteStoreError;
use crate::schema::{SCHEMA_VERSION, init_schema};

/// Thread-safe SQLite trace store implementation.
pub struct SqliteTraceStore {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteTraceStore {
    /// Opens an existing SQLite database file or creates it with initial schema.
    /// A database whose schema version does not match is dropped and rebuilt.
    pub fn open(path: impl AsRef<Path>) -> Result<Self, SqliteStoreError> {
        let conn = Connection::open(path)?;
        if schema_version(&conn)? != SCHEMA_VERSION {
            conn.execute_batch("DROP TABLE IF EXISTS messages_fts; DROP TABLE IF EXISTS messages; DROP TABLE IF EXISTS conversations; PRAGMA user_version = 0;")?;
        }
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
}

fn schema_version(conn: &Connection) -> Result<i64, SqliteStoreError> {
    conn.query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(SqliteStoreError::from)
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

fn meta_from_row(
    id_str: String,
    title: String,
    leaf_str: Option<String>,
    local_only_int: i32,
    last_model_json: Option<String>,
    created_at: i64,
    updated_at: i64,
) -> Result<ConversationMeta, SqliteStoreError> {
    let conv_id =
        Uuid::parse_str(&id_str).map_err(|e| SqliteStoreError::Database(e.to_string()))?;
    let leaf_id = leaf_str.and_then(|s| Uuid::parse_str(&s).ok());
    let last_model = match last_model_json {
        Some(json) => Some(serde_json::from_str(&json)?),
        None => None,
    };
    Ok(ConversationMeta {
        id: conv_id,
        title,
        leaf_id,
        local_only: local_only_int == 1,
        last_model,
        created_at,
        updated_at,
    })
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
                INSERT INTO conversations (id, title, leaf_id, local_only, last_model, created_at, updated_at)
                VALUES (?1, ?2, NULL, ?3, NULL, ?4, ?5)
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
                last_model: None,
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
                    SELECT id, title, leaf_id, local_only, last_model, created_at, updated_at
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
                    let last_model_json: Option<String> = row.get(4)?;
                    let created_at: i64 = row.get(5)?;
                    let updated_at: i64 = row.get(6)?;
                    Ok((
                        id_str,
                        title,
                        leaf_str,
                        local_only_int,
                        last_model_json,
                        created_at,
                        updated_at,
                    ))
                })
                .map_err(SqliteStoreError::from)?;

            match rows.next() {
                Some(res) => {
                    let (
                        id_str,
                        title,
                        leaf_str,
                        local_only_int,
                        last_model_json,
                        created_at,
                        updated_at,
                    ) = res.map_err(SqliteStoreError::from)?;
                    Ok(Some(meta_from_row(
                        id_str,
                        title,
                        leaf_str,
                        local_only_int,
                        last_model_json,
                        created_at,
                        updated_at,
                    )?))
                }
                None => Ok(None),
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

    fn update_message<'a>(&'a self, id: Uuid, update: MessageUpdate) -> BoxStoreFuture<'a, ()> {
        Box::pin(async move {
            let json_str =
                serde_json::to_string(&update.message).map_err(SqliteStoreError::from)?;
            let usage = match &update.message {
                Message::Assistant { usage, .. } => *usage,
                _ => None,
            };
            let usage_str = match usage {
                Some(u) => Some(serde_json::to_string(&u).map_err(SqliteStoreError::from)?),
                None => None,
            };
            let text_extract = update.message.visible_text();

            let conn = self.conn.lock();
            conn.execute(
                r#"
                UPDATE messages
                SET content_json = ?1, status = ?2, token_usage = ?3,
                    first_token_at = ?4, finished_at = ?5
                WHERE id = ?6
                "#,
                params![
                    json_str,
                    status_str(update.status),
                    usage_str,
                    update.first_token_at,
                    update.finished_at,
                    id.to_string()
                ],
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

    fn update_conversation_model<'a>(
        &'a self,
        id: Uuid,
        last_model: LastModel,
    ) -> BoxStoreFuture<'a, ()> {
        Box::pin(async move {
            let json = serde_json::to_string(&last_model).map_err(SqliteStoreError::from)?;
            let conn = self.conn.lock();
            conn.execute(
                r#"
                UPDATE conversations
                SET last_model = ?1
                WHERE id = ?2
                "#,
                params![json, id.to_string()],
            )
            .map_err(SqliteStoreError::from)?;
            Ok(())
        })
    }

    fn append_message<'a>(&'a self, entry: StoredMessage) -> BoxStoreFuture<'a, ()> {
        Box::pin(async move {
            let json_str = serde_json::to_string(&entry.message).map_err(SqliteStoreError::from)?;
            let usage = match &entry.message {
                Message::Assistant { usage, .. } => *usage,
                _ => None,
            };
            let usage_str = match usage {
                Some(u) => Some(serde_json::to_string(&u).map_err(SqliteStoreError::from)?),
                None => None,
            };
            let text_extract = entry.message.visible_text();

            let conn = self.conn.lock();
            conn.execute(
                r#"
                INSERT INTO messages (id, conversation_id, parent_id, content_json, status, model,
                                      provider_id, token_usage, started_at, first_token_at, finished_at, created_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, NULL, NULL, ?10)
                "#,
                params![
                    entry.id.to_string(),
                    entry.conversation_id.to_string(),
                    entry.parent_id.map(|p| p.to_string()),
                    json_str,
                    status_str(entry.status),
                    entry.model,
                    entry.provider_id.map(|p| p.to_string()),
                    usage_str,
                    entry.started_at,
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

    fn list_messages<'a>(
        &'a self,
        conversation_id: Uuid,
    ) -> BoxStoreFuture<'a, Vec<StoredMessage>> {
        Box::pin(async move {
            let conn = self.conn.lock();
            let mut stmt = conn
                .prepare(
                    r#"
                    SELECT id, conversation_id, parent_id, content_json, status, model, provider_id, started_at, created_at
                    FROM messages
                    WHERE conversation_id = ?1
                    ORDER BY created_at ASC, id ASC
                    "#,
                )
                .map_err(SqliteStoreError::from)?;

            let rows = stmt
                .query_map(params![conversation_id.to_string()], |row| {
                    let id_str: String = row.get(0)?;
                    let conv_str: String = row.get(1)?;
                    let parent_str: Option<String> = row.get(2)?;
                    let json_str: String = row.get(3)?;
                    let status: String = row.get(4)?;
                    let model: Option<String> = row.get(5)?;
                    let provider_str: Option<String> = row.get(6)?;
                    let started_at: i64 = row.get(7)?;
                    let created_at: i64 = row.get(8)?;
                    Ok((
                        id_str,
                        conv_str,
                        parent_str,
                        json_str,
                        status,
                        model,
                        provider_str,
                        started_at,
                        created_at,
                    ))
                })
                .map_err(SqliteStoreError::from)?;

            let mut list = Vec::new();
            for r in rows {
                let (
                    id_str,
                    conv_str,
                    parent_str,
                    json_str,
                    status,
                    model,
                    provider_str,
                    started_at,
                    created_at,
                ) = r.map_err(SqliteStoreError::from)?;

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
                    status: status_parse(&status),
                    model,
                    provider_id: provider_str.and_then(|s| Uuid::parse_str(&s).ok()),
                    started_at,
                    created_at,
                });
            }

            Ok(list)
        })
    }
}
