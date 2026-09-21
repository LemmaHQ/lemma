//! Conversation domain: lifecycle (create, rename, archive, restore,
//! delete) and message pagination, plus the queries for the
//! conversations and messages tables.

mod service;
pub mod store;
mod trace_store;

pub use service::ConversationService;
pub use trace_store::PgTraceStore;
