use std::path::Path;

use crate::tool_error::ToolError;

/// Result of executing a command in the environment.
#[derive(Debug, Clone)]
pub struct ExecCommandResult {
    /// Process exit status code.
    pub exit_code: i32,
    /// Captured standard output.
    pub stdout: String,
    /// Captured standard error.
    pub stderr: String,
}

/// Abstract host execution environment.
pub trait ExecEnv: Send + Sync {
    /// Reads a file below the sandbox root.
    ///
    /// # Errors
    ///
    /// [`ToolError::Validation`] for a path outside the sandbox and
    /// [`ToolError::Execution`] when reading fails.
    fn read_file(&self, path: &Path) -> impl Future<Output = Result<String, ToolError>> + Send;

    /// Writes a file below the sandbox root, creating missing directories.
    ///
    /// # Errors
    ///
    /// [`ToolError::Validation`] for a path outside the sandbox and
    /// [`ToolError::Execution`] when writing fails.
    fn write_file(
        &self,
        path: &Path,
        content: &str,
    ) -> impl Future<Output = Result<(), ToolError>> + Send;

    /// Executes a shell command in the sandbox workspace, or in `cwd` below
    /// it.
    ///
    /// # Errors
    ///
    /// [`ToolError::Validation`] for a `cwd` outside the sandbox and
    /// [`ToolError::Execution`] when the process cannot start.
    fn exec_command(
        &self,
        command: &str,
        cwd: Option<&Path>,
    ) -> impl Future<Output = Result<ExecCommandResult, ToolError>> + Send;
}
