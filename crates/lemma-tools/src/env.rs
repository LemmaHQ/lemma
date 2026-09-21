use std::future::Future;
use std::path::Path;
use std::pin::Pin;

use crate::error::ToolError;

/// Future returned by environment operations.
pub type BoxEnvFuture<'a, T> = Pin<Box<dyn Future<Output = Result<T, ToolError>> + Send + 'a>>;

/// Metadata for an inspected filesystem entry.
#[derive(Debug, Clone)]
pub struct FileMeta {
    /// Entry name.
    pub name: String,
    /// True if the entry is a directory.
    pub is_dir: bool,
    /// Size in bytes.
    pub size: u64,
}

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
///
/// Implemented by Desktop (direct host OS filesystem and terminal) and
/// Mobile (app-private sandbox / Storage Access Framework scope).
pub trait ExecEnv: Send + Sync {
    /// Reads a file from the sandbox root.
    fn read_file<'a>(&'a self, path: &'a Path) -> BoxEnvFuture<'a, String>;

    /// Writes or overwrites a file in the sandbox.
    fn write_file<'a>(&'a self, path: &'a Path, content: &'a str) -> BoxEnvFuture<'a, ()>;

    /// Lists directory entries.
    fn list_dir<'a>(&'a self, path: &'a Path) -> BoxEnvFuture<'a, Vec<FileMeta>>;

    /// Executes a shell command within the sandbox workspace.
    fn exec_command<'a>(
        &'a self,
        command: &'a str,
        cwd: Option<&'a Path>,
    ) -> BoxEnvFuture<'a, ExecCommandResult>;
}
