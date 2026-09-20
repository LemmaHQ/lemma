//! Platform-agnostic agent orchestration core and conversation tree model.
//!
//! This crate contains the core execution loop that drives conversations,
//! invokes providers, and handles branching navigation. It depends only on
//! `lemma-trace`, `lemma-adapter`, and abstract traits like [`TraceStore`].

mod error;
mod loop_core;
mod store;
mod tree;

pub use error::AgentError;
pub use loop_core::{AgentConfig, AgentLoop};
pub use store::{BoxStoreFuture, ConversationMeta, StoredMessage, TraceStore};
pub use tree::{SessionTree, build_context_path};
