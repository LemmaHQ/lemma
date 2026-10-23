use sqlx::PgPool;
use sqlx::migrate::MigrateError;
use sqlx::postgres::PgPoolOptions;

/// Creates a PostgreSQL connection pool with default options.
///
/// # Errors
///
/// The [`sqlx::Error`] when the server is unreachable or rejects the
/// connection.
pub async fn connect(url: &str) -> sqlx::Result<PgPool> {
    PgPoolOptions::new().connect(url).await
}

/// Runs the migrations embedded from `./migrations` at compile time.
///
/// # Errors
///
/// The [`MigrateError`] when a migration fails or the applied history
/// diverges from the embedded one.
pub async fn migrate(pool: &PgPool) -> Result<(), MigrateError> {
    sqlx::migrate!("./migrations").run(pool).await
}
