//! In-memory SQLite databases migrated to the workspace schema for tests.

use sqlx::SqlitePool;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

/// Opens a freshly migrated in-memory SQLite pool with foreign keys enabled.
///
/// # Errors
///
/// [`sqlx::Error`] when opening or migrating the database fails.
pub async fn database() -> Result<SqlitePool, sqlx::Error> {
    let options = SqliteConnectOptions::new()
        .in_memory(true)
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await?;
    sqlx::migrate!("../../rpc/lemma-host/migrations")
        .run(&pool)
        .await?;
    Ok(pool)
}
