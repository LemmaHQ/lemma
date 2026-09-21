//! Plaintext SQLite trace store implementation for Local Mode.
//!
//! Provides the local database engine for Desktop and Mobile clients,
//! implementing [`lemma_session::TraceStore`], FTS5 full-text indexing,
//! and offline outbox synchronization queues.

mod error;
pub mod outbox;
mod schema;
mod store;

pub use error::SqliteStoreError;
pub use outbox::OutboxItem;
pub use store::SqliteTraceStore;
