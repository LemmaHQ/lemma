//! PostgreSQL storage backend: connection pool, migrations, row entities,
//! and all SQL for the shared and server-only domains.
//!
//! Other crates consume the public query modules and row types exclusively; all SQL
//! queries reside strictly within this crate.

pub mod entity;
mod pool;
pub mod queries;
pub mod stores;

pub use pool::{connect, migrate};
pub use queries::auth::{credentials, tokens};
pub use queries::{conversations, providers, users};
pub use stores::pg_auth_store::PgAuthStore;
pub use stores::pg_conversation_store::PgConversationStore;
pub use stores::pg_provider_store::PgProviderStore;
