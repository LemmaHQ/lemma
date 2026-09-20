//! Plaintext SQLite trace store implementation and Local Mode engine.
//!
//! Provides the local database engine for Desktop and Mobile clients,
//! implementing [`lemma_agent::TraceStore`], FTS5 full-text indexing,
//! the [`QueryHistoryTool`] agent capability, and the high-level [`LocalEngine`] assembly.

mod engine;
mod error;
mod query_tool;
mod schema;
mod store;

pub use engine::LocalEngine;
pub use error::SqliteStoreError;
pub use query_tool::QueryHistoryTool;
pub use store::SqliteTraceStore;
