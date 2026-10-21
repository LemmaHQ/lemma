//! Tool specifications, execution environment abstractions, and safety approval gates.

mod approval;
mod builtin;
mod env;
mod error;
mod registry;
mod tool;

pub use approval::{ApprovalDecision, ApprovalPolicy, ToolTier};
pub use builtin::{BashTool, ReadFileTool, WriteFileTool};
pub use env::{BoxEnvFuture, ExecCommandResult, ExecEnv, LocalExecEnv};
pub use error::ToolError;
pub use registry::ToolRegistry;
pub use tool::{BoxToolFuture, Tool, ToolSpec};
