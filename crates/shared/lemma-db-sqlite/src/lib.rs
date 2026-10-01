//! Plaintext SQLite storage backend for embedded clients.
//!
//! Owns the SQLite schema (migrations embedded from `./migrations`) and all
//! SQL for the local store; other modules consume the public functions and
//! row types only.

pub mod conversations;
pub mod entity;
mod error;
pub mod providers;
pub mod settings;
mod store;
pub mod users;

pub use error::SqliteStoreError;
pub use store::SqliteTraceStore;

use std::path::Path;

use sqlx::SqlitePool;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};

pub(crate) fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as i64)
}

/// Opens or creates a SQLite database file with WAL mode and foreign keys on.
pub async fn connect(path: impl AsRef<Path>) -> sqlx::Result<SqlitePool> {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .foreign_keys(true);
    SqlitePoolOptions::new().connect_with(options).await
}

/// Creates an in-memory database pinned to a single connection.
pub async fn connect_in_memory() -> sqlx::Result<SqlitePool> {
    SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
}

/// Runs the migrations embedded from `./migrations` at compile time.
pub async fn migrate(pool: &SqlitePool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("./migrations").run(pool).await
}
