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
pub use queries::conversations;
pub use stores::sqlite_conversation_store::SqliteConversationStore;
