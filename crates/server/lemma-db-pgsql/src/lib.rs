//! PostgreSQL storage backend: connection pool, migrations, row entities,
//! and all SQL for the shared and server-only domains.
//!
//! Other crates consume the public query modules and row types only; no SQL
//! lives outside this crate.

pub mod entity;
pub mod queries;
pub mod stores;

pub use queries::auth::{credentials, tokens};
pub use queries::{conversations, providers, settings, users};
pub use stores::auth::PgAuthStore;
pub use stores::conversation::PgConversationStore;
pub use stores::provider::PgProviderStore;
pub use stores::trace::PgTraceStore;

use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;

/// Creates a PostgreSQL connection pool with default options.
pub async fn connect(url: &str) -> sqlx::Result<PgPool> {
    PgPoolOptions::new().connect(url).await
}

/// Runs the migrations embedded from `./migrations` at compile time.
pub async fn migrate(pool: &PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("./migrations").run(pool).await
}
