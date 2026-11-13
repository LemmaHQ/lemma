//! SQLite connection pools migrated to the workspace schema.

use std::path::Path;

use sqlx::SqlitePool;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};

/// Opens the SQLite database at `path` (creating it when missing) in WAL mode
/// with foreign keys enabled, and applies pending schema migrations.
///
/// # Errors
///
/// [`sqlx::Error`] when opening, creating, or migrating the database fails.
pub async fn open(path: &Path) -> Result<SqlitePool, sqlx::Error> {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new().connect_with(options).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}

/// Opens a freshly migrated single-connection in-memory SQLite pool with
/// foreign keys enabled.
///
/// # Errors
///
/// [`sqlx::Error`] when opening or migrating the database fails.
pub async fn in_memory() -> Result<SqlitePool, sqlx::Error> {
    let options = SqliteConnectOptions::new()
        .in_memory(true)
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}
