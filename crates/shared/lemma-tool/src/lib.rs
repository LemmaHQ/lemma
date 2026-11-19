//! Tool specifications, execution environment abstractions, and turn
//! cancellation.
//!
//! # Execution invariants
//!
//! - [`LocalExecEnv`] confines file reads and writes to its root directory:
//!   paths containing `..` are rejected, and every path canonicalizes its
//!   nearest existing ancestor before appending missing components so symlinks
//!   escaping the root and dangling symlinks are both rejected.
//! - [`BashTool`] runs commands in the root (`cmd /C` on Windows, `sh -c`
//!   elsewhere) with a 1–3600 s timeout (default 300 s) and retains the first
//!   and last 16 KB of each output stream. On timeout or cancellation it
//!   terminates the entire process tree: `SIGTERM` followed 2 s later by
//!   `SIGKILL` to the process group on Unix, and `taskkill /T /F` on Windows.

mod builtin;
mod cancel_token;
mod exec_env;
mod local_exec_env;
mod output_capture;
mod tool;
mod tool_error;
mod tool_registry;
mod web;

pub use builtin::{BashTool, ReadFileTool, WriteFileTool};
pub use cancel_token::CancelToken;
pub use exec_env::{CommandStop, ExecCommandResult, ExecEnv};
pub use lemma_core::ToolSpec;
pub use local_exec_env::LocalExecEnv;
pub use tool::{BoxToolFuture, Tool};
pub use tool_error::ToolError;
pub use tool_registry::ToolRegistry;
pub use web::{WebFetchBackend, WebFetchTool, WebSearchBackend, WebSearchTool};
