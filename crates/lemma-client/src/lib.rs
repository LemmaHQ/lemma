//! Unified client engine facade for Lemma Desktop and Mobile applications.
//!
//! Provides the [`ClientEngine`] trait isolating UI layers from whether
//! execution occurs locally via on-device SQLite ([`LocalClientEngine`])
//! or remotely via ConnectRPC gateway ([`RemoteClientEngine`]).

mod engine;
mod error;
mod local;
mod query_tool;
mod remote;

pub use engine::{BoxClientFuture, ClientEngine, EngineMode};
pub use error::ClientError;
pub use local::LocalClientEngine;
pub use query_tool::QueryHistoryTool;
pub use remote::RemoteClientEngine;
