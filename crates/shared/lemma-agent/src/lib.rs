//! Platform-agnostic agent orchestration core.
//!
//! This crate contains the core execution loop that drives conversations
//! and invokes providers. Session tree topology and persistence contracts
//! live in `lemma-session`; this crate depends only on `lemma-core`,
//! `lemma-adapter`, and `lemma-session`.

mod error;
mod loop_core;

pub use error::AgentError;
pub use loop_core::{AgentConfig, AgentLoop, BoxTurnObserver, TurnEvent};
