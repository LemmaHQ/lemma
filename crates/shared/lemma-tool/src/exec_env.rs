use std::fmt::{self, Display};
use std::path::Path;
use std::time::Duration;

use crate::tool_error::ToolError;

/// Why a command was stopped before it exited.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommandStop {
    /// The command ran past its timeout.
    TimedOut(Duration),
    /// The turn was cancelled.
    Aborted,
}

impl Display for CommandStop {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::TimedOut(timeout) => write!(f, "timed out after {} s", timeout.as_secs()),
            Self::Aborted => f.write_str("aborted"),
        }
    }
}

/// Result of executing a command in the environment.
#[derive(Debug, Clone)]
pub struct ExecCommandResult {
    /// Process exit status code; `None` when a signal ended the process.
    pub exit_code: Option<i32>,
    /// Captured standard output.
    pub stdout: String,
    /// Captured standard error.
    pub stderr: String,
    /// Why the command was stopped; `None` when it exited by itself.
    pub stop: Option<CommandStop>,
}

/// Abstract host execution environment.
pub trait ExecEnv: Send + Sync {
    /// Reads a file below the root.
    ///
    /// # Errors
    ///
    /// [`ToolError::Validation`] for a path outside the root and
    /// [`ToolError::Execution`] when reading fails.
    fn read_file(&self, path: &Path) -> impl Future<Output = Result<String, ToolError>> + Send;

    /// Writes a file below the root, creating missing directories.
    ///
    /// # Errors
    ///
    /// [`ToolError::Validation`] for a path outside the root and
    /// [`ToolError::Execution`] when writing fails.
    fn write_file(
        &self,
        path: &Path,
        content: &str,
    ) -> impl Future<Output = Result<(), ToolError>> + Send;

    /// Executes a shell command in the root, stopping it once it runs
    /// past `timeout` or the turn is cancelled.
    ///
    /// # Errors
    ///
    /// [`ToolError::Execution`] when the process cannot start.
    fn exec_command(
        &self,
        command: &str,
        timeout: Duration,
    ) -> impl Future<Output = Result<ExecCommandResult, ToolError>> + Send;
}
