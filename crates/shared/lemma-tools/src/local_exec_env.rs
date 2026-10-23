use std::path::{Component, Path, PathBuf};

use tokio::{fs, process};

use crate::exec_env::{ExecCommandResult, ExecEnv};
use crate::tool_error::ToolError;

/// Host execution environment rooted at a workspace directory.
#[derive(Debug)]
pub struct LocalExecEnv {
    root: PathBuf,
}

impl LocalExecEnv {
    /// Creates an environment confined to `root`.
    #[must_use]
    pub fn new(root: PathBuf) -> Self {
        Self { root }
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
    async fn read_file(&self, path: &Path) -> Result<String, ToolError> {
        let resolved = self.resolve(path)?;
        fs::read_to_string(&resolved)
            .await
            .map_err(|e| ToolError::Execution(format!("read {}: {e}", path.display())))
    }

    async fn write_file(&self, path: &Path, content: &str) -> Result<(), ToolError> {
        let resolved = self.resolve(path)?;
        if let Some(parent) = resolved.parent() {
            fs::create_dir_all(parent).await.map_err(|e| {
                ToolError::Execution(format!("create dirs for {}: {e}", path.display()))
            })?;
        }
        fs::write(&resolved, content)
            .await
            .map_err(|e| ToolError::Execution(format!("write {}: {e}", path.display())))
    }

    async fn exec_command(
        &self,
        command: &str,
        cwd: Option<&Path>,
    ) -> Result<ExecCommandResult, ToolError> {
        let workdir = match cwd {
            Some(path) => self.resolve(path)?,
            None => self.root.clone(),
        };
        let mut process = if cfg!(windows) {
            let mut cmd = process::Command::new("cmd");
            cmd.arg("/C").arg(command);
            cmd
        } else {
            let mut cmd = process::Command::new("sh");
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
    }
}
