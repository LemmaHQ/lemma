//! Plaintext SQLite storage backend for embedded clients.
//!
//! Owns the SQLite schema (migrations embedded from `./migrations`) and all
//! SQL for the local store; other modules consume the public functions and
//! row types only.

mod clock;
pub mod entity;
mod pool;
pub mod queries;
pub mod stores;

pub use pool::{connect, connect_in_memory, migrate};
pub use queries::auth::{credentials, tokens};
pub use queries::{conversations, providers, users};
pub use stores::sqlite_auth_store::SqliteAuthStore;
pub use stores::sqlite_conversation_store::SqliteConversationStore;
pub use stores::sqlite_provider_store::SqliteProviderStore;
