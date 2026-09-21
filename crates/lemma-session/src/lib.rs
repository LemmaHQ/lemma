//! Platform-agnostic conversation session model.
//!
//! Contains the in-memory session tree projection, branching navigation,
//! context assembly, and the [`TraceStore`] persistence abstraction.
//! Zero I/O and zero runtime bindings: hosts (server, desktop, mobile)
//! supply concrete store implementations.

mod error;
mod store;
mod tree;

pub use error::SessionError;
pub use store::{BoxStoreFuture, ConversationMeta, StoredMessage, TraceStore};
pub use tree::{SessionTree, build_context_path};
