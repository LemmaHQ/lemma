use rusqlite::Connection;

use crate::error::SqliteStoreError;

/// Initializes the plaintext SQLite schema, WAL mode, FTS5 index, and sync outbox.
pub(crate) fn init_schema(conn: &Connection) -> Result<(), SqliteStoreError> {
    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS sync_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            last_sync_seq INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL
        );

        INSERT OR IGNORE INTO sync_state (id, last_sync_seq, updated_at)
        VALUES (1, 0, 0);

        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            leaf_id TEXT,
            local_only INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            parent_id TEXT,
            content_json TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id);

        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
            message_id UNINDEXED,
            conversation_id UNINDEXED,
            text_content
        );

        CREATE TABLE IF NOT EXISTS outbox (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL, -- 'conversation' or 'message'
            entity_id TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_outbox_created ON outbox(created_at);
        "#,
    )?;
    Ok(())
}
