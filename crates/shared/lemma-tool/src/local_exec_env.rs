use std::io;
use std::path::{Component, Path, PathBuf};
use std::pin::{Pin, pin};
use std::process::{ExitStatus, Stdio};
use std::time::Duration;

use tokio::{fs, process, time};

use crate::cancel_token::CancelToken;
use crate::exec_env::{CommandStop, ExecCommandResult, ExecEnv};
use crate::output_capture::OutputCapture;
use crate::tool_error::ToolError;

#[cfg(not(windows))]
const STOP_GRACE: Duration = Duration::from_secs(2);

type Finished = (OutputCapture, OutputCapture, io::Result<ExitStatus>);

/// Host execution environment confined to a root directory.
///
/// Paths resolve through symlinks and must land under the canonical root;
/// a dangling link is refused. Commands start in the root and are
/// otherwise unconfined; a stopped command's whole process tree ends.
#[derive(Debug)]
pub struct LocalExecEnv {
    root: PathBuf,
    cancel: CancelToken,
}

impl LocalExecEnv {
    /// The shell commands run in.
    #[cfg(windows)]
    pub const SHELL: &str = "cmd";
    /// The shell commands run in.
    #[cfg(not(windows))]
    pub const SHELL: &str = "sh";

    /// Opens an environment confined to the canonical form of `root`, whose
    /// running command stops when `cancel` fires.
    ///
    /// # Errors
    ///
    /// The [`io::Error`] when `root` cannot be resolved, for example
    /// because it does not exist.
    pub async fn open(root: &Path, cancel: CancelToken) -> io::Result<Self> {
        Ok(Self {
            root: canonical(root).await?,
            cancel,
        })
    }

    /// The canonical root directory.
    #[must_use]
    pub fn root(&self) -> &Path {
        &self.root
    }

    async fn resolve(&self, path: &Path) -> Result<PathBuf, ToolError> {
        let outside = || {
            ToolError::Validation(format!(
                "path outside the session directory: {}",
                path.display()
            ))
        };
        if path.components().any(|part| part == Component::ParentDir) {
            return Err(outside());
        }
        let target = self.root.join(path);
        let mut existing = target.as_path();
        while fs::symlink_metadata(existing).await.is_err()
            && let Some(parent) = existing.parent()
        {
            existing = parent;
        }
        let mut resolved = canonical(existing)
            .await
            .map_err(|e| ToolError::Validation(format!("resolve {}: {e}", path.display())))?;
        resolved.extend(target.strip_prefix(existing).unwrap_or(Path::new("")));
        if resolved.starts_with(&self.root) {
            Ok(resolved)
        } else {
            Err(outside())
        }
    }
}

impl ExecEnv for LocalExecEnv {
    async fn read_file(&self, path: &Path) -> Result<String, ToolError> {
        let resolved = self.resolve(path).await?;
        fs::read_to_string(&resolved)
            .await
            .map_err(|e| ToolError::Execution(format!("read {}: {e}", path.display())))
    }

    async fn write_file(&self, path: &Path, content: &str) -> Result<(), ToolError> {
        let resolved = self.resolve(path).await?;
        let parent = resolved.parent().unwrap_or(&self.root);
        fs::create_dir_all(parent).await.map_err(|e| {
            ToolError::Execution(format!("create dirs for {}: {e}", path.display()))
        })?;
        fs::write(&resolved, content)
            .await
            .map_err(|e| ToolError::Execution(format!("write {}: {e}", path.display())))
    }

    async fn exec_command(
        &self,
        command: &str,
        timeout: Duration,
    ) -> Result<ExecCommandResult, ToolError> {
        let mut child = shell(command)
            .current_dir(&self.root)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| ToolError::Execution(format!("spawn command: {e}")))?;
        let pid = child.id().ok_or(ToolError::Execution(String::from(
            "spawn command: no process id",
        )))?;
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let mut run = pin!(async {
            tokio::join!(
                OutputCapture::read(stdout),
                OutputCapture::read(stderr),
                child.wait(),
            )
        });
        let stop = tokio::select! {
            finished = &mut run => return Ok(command_result(finished, None)),
            () = time::sleep(timeout) => CommandStop::TimedOut(timeout),
            () = self.cancel.cancelled() => CommandStop::Aborted,
        };
        let finished = stop_tree(pid, run).await;
        Ok(command_result(finished, Some(stop)))
    }
}

/// The canonical form of `path`, without the `\\?\` prefix Windows adds,
/// so that `cmd` accepts it as a working directory.
async fn canonical(path: &Path) -> io::Result<PathBuf> {
    let canonical = fs::canonicalize(path).await?;
    Ok(dunce::simplified(&canonical).to_path_buf())
}

fn command_result(
    (stdout, stderr, status): Finished,
    stop: Option<CommandStop>,
) -> ExecCommandResult {
    ExecCommandResult {
        exit_code: status.ok().and_then(|status| status.code()),
        stdout: stdout.into_text(),
        stderr: stderr.into_text(),
        stop,
    }
}

#[cfg(windows)]
fn shell(command: &str) -> process::Command {
    let mut cmd = process::Command::new(LocalExecEnv::SHELL);
    cmd.arg("/C").arg(command);
    cmd
}

#[cfg(not(windows))]
fn shell(command: &str) -> process::Command {
    let mut cmd = process::Command::new(LocalExecEnv::SHELL);
    cmd.arg("-c").arg(command).process_group(0);
    cmd
}

#[cfg(windows)]
async fn stop_tree(pid: u32, run: Pin<&mut impl Future<Output = Finished>>) -> Finished {
    let _ = process::Command::new("taskkill")
        .args(["/T", "/F", "/PID", &pid.to_string()])
        .output()
        .await;
    run.await
}

#[cfg(not(windows))]
async fn stop_tree(pid: u32, mut run: Pin<&mut impl Future<Output = Finished>>) -> Finished {
    signal_group(pid, libc::SIGTERM);
    if let Ok(finished) = time::timeout(STOP_GRACE, run.as_mut()).await {
        return finished;
    }
    signal_group(pid, libc::SIGKILL);
    run.await
}

#[cfg(not(windows))]
fn signal_group(pid: u32, signal: libc::c_int) {
    // SAFETY: `kill` takes no pointers; the negated id names the process
    // group the command leads, created by `process_group(0)`.
    unsafe { libc::kill(-pid.cast_signed(), signal) };
}
