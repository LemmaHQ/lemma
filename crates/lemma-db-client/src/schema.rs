use rusqlite::Connection;

use crate::error::SqliteStoreError;

/// Schema version recorded in `PRAGMA user_version`; a mismatch on open
/// drops and rebuilds the database.
pub(crate) const SCHEMA_VERSION: i64 = 1;

/// Initializes the plaintext SQLite schema, WAL mode, FTS5 index.
pub(crate) fn init_schema(conn: &Connection) -> Result<(), SqliteStoreError> {
    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            leaf_id TEXT,
            local_only INTEGER NOT NULL DEFAULT 0,
            last_model TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            parent_id TEXT,
            content_json TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'done',
            model TEXT,
            provider_id TEXT,
            token_usage TEXT,
            started_at INTEGER NOT NULL DEFAULT 0,
            first_token_at INTEGER,
            finished_at INTEGER,
            created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id);

        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
            message_id UNINDEXED,
            conversation_id UNINDEXED,
            text_content
        );

        "#,
    )?;
    conn.pragma_update(None, "user_version", SCHEMA_VERSION)?;
    Ok(())
}
