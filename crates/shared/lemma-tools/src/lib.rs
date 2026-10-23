//! Tool specifications, execution environment abstractions, and safety approval gates.

mod approval_policy;
mod builtin;
mod exec_env;
mod local_exec_env;
mod tool;
mod tool_error;
mod tool_registry;

pub use approval_policy::{ApprovalDecision, ApprovalPolicy};
pub use builtin::{BashTool, ReadFileTool, WriteFileTool};
pub use exec_env::{ExecCommandResult, ExecEnv};
pub use lemma_core::ToolSpec;
pub use local_exec_env::LocalExecEnv;
pub use tool::{BoxToolFuture, Tool, ToolTier};
pub use tool_error::ToolError;
pub use tool_registry::ToolRegistry;
