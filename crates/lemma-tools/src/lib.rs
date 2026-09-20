//! Tool specifications, execution environment abstractions, and safety approval gates.
//!
//! Provides the core abstraction for tools that agents can discover,
//! validate, and execute across desktop and mobile sandbox boundaries.

mod approval;
mod builtins;
mod env;
mod error;
mod registry;
mod tool;

pub use approval::{ApprovalDecision, ApprovalPolicy, ToolTier};
pub use builtins::{BashTool, ReadFileTool, WriteFileTool};
pub use env::{BoxEnvFuture, ExecCommandResult, ExecEnv, FileMeta};
pub use error::ToolError;
pub use registry::ToolRegistry;
pub use tool::{BoxToolFuture, Tool, ToolSpec};
