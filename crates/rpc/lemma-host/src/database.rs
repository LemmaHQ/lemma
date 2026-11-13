use std::path::Path;

use sqlx::SqlitePool;
use sqlx::migrate::MigrateError;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};

/// Opens the SQLite database at `path`, creating it when missing, in WAL mode
/// with foreign keys enabled.
///
/// # Errors
///
/// [`sqlx::Error`] when the database file cannot be opened or created.
pub async fn connect(path: &Path) -> Result<SqlitePool, sqlx::Error> {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .foreign_keys(true);
    SqlitePoolOptions::new().connect_with(options).await
}

/// Applies pending schema migrations to `db`.
///
/// # Errors
///
/// [`MigrateError`] of the failing migration.
pub async fn migrate(db: &SqlitePool) -> Result<(), MigrateError> {
    sqlx::migrate!("./migrations").run(db).await
}
