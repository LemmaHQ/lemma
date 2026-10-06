use std::path::{Component, Path, PathBuf};

use crate::env::{BoxEnvFuture, ExecCommandResult, ExecEnv, FileMeta};
use crate::error::ToolError;

/// Direct host-OS execution environment rooted at a workspace directory.
///
/// All file operations are confined to the workspace root: absolute paths
/// and paths escaping the root via `..` are rejected before touching the
/// filesystem.
pub struct LocalExecEnv {
    root: PathBuf,
}

impl LocalExecEnv {
    /// Creates an environment confined to `root`.
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    fn resolve(&self, path: &Path) -> Result<PathBuf, ToolError> {
        if path.is_absolute() {
            return Err(ToolError::Validation(format!(
                "absolute path rejected: {}",
                path.display()
            )));
        }
        let mut resolved = self.root.clone();
        for component in path.components() {
            match component {
                Component::Normal(part) => resolved.push(part),
                Component::CurDir => {}
                _ => {
                    return Err(ToolError::Validation(format!(
                        "path escapes workspace: {}",
                        path.display()
                    )));
                }
            }
        }
        Ok(resolved)
    }
}

impl ExecEnv for LocalExecEnv {
    fn read_file<'a>(&'a self, path: &'a Path) -> BoxEnvFuture<'a, String> {
        Box::pin(async move {
            let resolved = self.resolve(path)?;
            tokio::fs::read_to_string(&resolved)
                .await
                .map_err(|e| ToolError::Execution(format!("read {}: {e}", path.display())))
        })
    }

    fn write_file<'a>(&'a self, path: &'a Path, content: &'a str) -> BoxEnvFuture<'a, ()> {
        Box::pin(async move {
            let resolved = self.resolve(path)?;
            if let Some(parent) = resolved.parent() {
                tokio::fs::create_dir_all(parent).await.map_err(|e| {
                    ToolError::Execution(format!("create dirs for {}: {e}", path.display()))
                })?;
            }
            tokio::fs::write(&resolved, content)
                .await
                .map_err(|e| ToolError::Execution(format!("write {}: {e}", path.display())))
        })
    }

    fn list_dir<'a>(&'a self, path: &'a Path) -> BoxEnvFuture<'a, Vec<FileMeta>> {
        Box::pin(async move {
            let resolved = self.resolve(path)?;
            let mut entries = tokio::fs::read_dir(&resolved)
                .await
                .map_err(|e| ToolError::Execution(format!("list {}: {e}", path.display())))?;
            let mut metas = Vec::new();
            while let Some(entry) = entries
                .next_entry()
                .await
                .map_err(|e| ToolError::Execution(format!("list {}: {e}", path.display())))?
            {
                let meta = entry
                    .metadata()
                    .await
                    .map_err(|e| ToolError::Execution(format!("stat entry: {e}")))?;
                metas.push(FileMeta {
                    name: entry.file_name().to_string_lossy().into_owned(),
                    is_dir: meta.is_dir(),
                    size: meta.len(),
                });
            }
            Ok(metas)
        })
    }

    fn exec_command<'a>(
        &'a self,
        command: &'a str,
        cwd: Option<&'a Path>,
    ) -> BoxEnvFuture<'a, ExecCommandResult> {
        Box::pin(async move {
            let workdir = match cwd {
                Some(path) => self.resolve(path)?,
                None => self.root.clone(),
            };
            let mut process = if cfg!(windows) {
                let mut cmd = tokio::process::Command::new("cmd");
                cmd.arg("/C").arg(command);
                cmd
            } else {
                let mut cmd = tokio::process::Command::new("sh");
                cmd.arg("-c").arg(command);
                cmd
            };
            let output = process
                .current_dir(&workdir)
                .output()
                .await
                .map_err(|e| ToolError::Execution(format!("spawn command: {e}")))?;
            Ok(ExecCommandResult {
                exit_code: output.status.code().unwrap_or(-1),
                stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
                stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            })
        })
    }
}
