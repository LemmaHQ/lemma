use std::path::Path;

use sqlx::SqlitePool;
use sqlx::migrate::MigrateError;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};

/// Opens or creates a SQLite database file with WAL mode and foreign keys on.
///
/// # Errors
///
/// The [`sqlx::Error`] when the file cannot be opened or created.
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
///
/// # Errors
///
/// The [`sqlx::Error`] when the connection cannot be opened.
pub async fn connect_in_memory() -> sqlx::Result<SqlitePool> {
    SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
}

/// Runs the migrations embedded from `./migrations` at compile time.
///
/// # Errors
///
/// The [`MigrateError`] when a migration fails or the applied history
/// diverges from the embedded one.
pub async fn migrate(pool: &SqlitePool) -> Result<(), MigrateError> {
    sqlx::migrate!("./migrations").run(pool).await
}
