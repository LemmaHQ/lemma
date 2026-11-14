//! File-backed and in-memory SQLite pool creation, migrations, and foreign keys.

use std::env;
use std::error::Error;
use std::fs;
use std::path::PathBuf;
use std::process;
use std::sync::atomic::{AtomicUsize, Ordering};

use sqlx::SqlitePool;
use sqlx::sqlite::SqliteConnectOptions;

static NEXT_DIR: AtomicUsize = AtomicUsize::new(0);

struct TempDir(PathBuf);

impl TempDir {
    fn new() -> Result<Self, Box<dyn Error>> {
        let index = NEXT_DIR.fetch_add(1, Ordering::Relaxed);
        let dir = env::temp_dir().join(format!("lemma-db-test-{}-{index}", process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir)?;
        Ok(Self(dir))
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

async fn assert_foreign_keys_enforced(pool: &SqlitePool) -> Result<(), Box<dyn Error>> {
    let result = sqlx::query(
        "INSERT INTO messages (id, session_id, body, status, created_at, updated_at)
         VALUES (X'01', X'02', '{}', 'done', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
    )
    .execute(pool)
    .await;
    assert!(result.is_err(), "foreign keys reject an orphan message");
    Ok(())
}

async fn assert_message_tree_schema(pool: &SqlitePool) -> Result<(), Box<dyn Error>> {
    let label_columns: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pragma_table_info('messages') WHERE name = 'label' AND type = 'TEXT'",
    )
    .fetch_one(pool)
    .await?;
    assert_eq!(label_columns, 1, "messages.label column exists");

    let parent_index: Option<String> = sqlx::query_scalar(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'messages' AND name = 'idx_messages_session_id_parent_id'",
    )
    .fetch_optional(pool)
    .await?;
    assert_eq!(
        parent_index.as_deref(),
        Some("idx_messages_session_id_parent_id"),
        "messages(session_id, parent_id) index exists"
    );
    Ok(())
}

#[tokio::test]
async fn in_memory_migrates_schema_and_enforces_foreign_keys() -> Result<(), Box<dyn Error>> {
    let pool = lemma_db::in_memory().await?;
    assert_foreign_keys_enforced(&pool).await?;
    assert_message_tree_schema(&pool).await?;
    pool.close().await;
    Ok(())
}

#[tokio::test]
async fn open_creates_migrates_and_enforces_foreign_keys() -> Result<(), Box<dyn Error>> {
    let dir = TempDir::new()?;
    let path = dir.0.join("lemma.db");
    let pool = lemma_db::open(&path).await?;
    assert!(path.is_file(), "database file was created");
    assert_foreign_keys_enforced(&pool).await?;
    assert_message_tree_schema(&pool).await?;
    pool.close().await;
    Ok(())
}

#[tokio::test]
async fn open_fails_when_path_is_a_directory() -> Result<(), Box<dyn Error>> {
    let dir = TempDir::new()?;
    let result = lemma_db::open(&dir.0).await;
    assert!(result.is_err(), "directory path cannot be opened as SQLite");
    Ok(())
}

#[tokio::test]
async fn open_fails_when_migration_checksum_mismatches() -> Result<(), Box<dyn Error>> {
    let dir = TempDir::new()?;
    let path = dir.0.join("lemma.db");
    lemma_db::open(&path).await?.close().await;

    let raw = SqlitePool::connect_with(SqliteConnectOptions::new().filename(&path)).await?;
    sqlx::query("UPDATE _sqlx_migrations SET checksum = X'00'")
        .execute(&raw)
        .await?;
    raw.close().await;

    let Err(err) = lemma_db::open(&path).await else {
        return Err("corrupted migration checksum must fail".into());
    };
    assert!(
        matches!(err, sqlx::Error::Migrate(_)),
        "expected sqlx::Error::Migrate, got {err:?}"
    );
    Ok(())
}
