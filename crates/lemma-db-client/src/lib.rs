//! Plaintext SQLite trace store implementation for Local Mode.
//!
//! Provides the local database engine for Desktop and Mobile clients,
//! implementing [`lemma_session::TraceStore`] and FTS5 full-text indexing.

mod error;
mod schema;
mod store;

pub use error::SqliteStoreError;
pub use store::SqliteTraceStore;
