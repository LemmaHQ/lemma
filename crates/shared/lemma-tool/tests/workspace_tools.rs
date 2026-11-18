//! The builtin tools and `LocalExecEnv` against a real temporary workspace.

use std::collections::BTreeSet;
use std::env;
use std::error::Error;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use lemma_tool::{
    BashTool, CancelToken, CommandStop, ExecEnv, LocalExecEnv, ReadFileTool, ToolError,
    ToolRegistry, WriteFileTool,
};
use serde_json::{Value, json};
use tokio::time;
use uuid::Uuid;

/// Prints `started`, then waits far longer than any test timeout.
#[cfg(windows)]
const STARTED_THEN_WAITS: &str = "echo started&& ping -n 60 127.0.0.1 >nul";
#[cfg(not(windows))]
const STARTED_THEN_WAITS: &str = "echo started; sleep 60";

struct Workspace(PathBuf);

impl Workspace {
    fn new() -> Result<Self, Box<dyn Error>> {
        let root = env::temp_dir().join(format!("lemma-tool-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&root)?;
        Ok(Self(root))
    }

    async fn env(&self) -> io::Result<LocalExecEnv> {
        LocalExecEnv::open(&self.0, CancelToken::new()).await
    }
}

impl Drop for Workspace {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn registry() -> ToolRegistry<LocalExecEnv> {
    let mut registry = ToolRegistry::new();
    registry.register(BashTool);
    registry.register(ReadFileTool);
    registry.register(WriteFileTool);
    registry
}

async fn run(
    registry: &ToolRegistry<LocalExecEnv>,
    env: &LocalExecEnv,
    name: &str,
    args: Value,
) -> Result<Value, ToolError> {
    let Some(tool) = registry.get(name) else {
        return Err(ToolError::Validation(format!("no tool {name}")));
    };
    tool.execute(args, env).await
}

async fn assert_outside(env: &LocalExecEnv, path: &Path) {
    let read = env.read_file(path).await;
    assert!(
        matches!(read, Err(ToolError::Validation(_))),
        "read {path:?}: {read:?}"
    );
    let write = env.write_file(path, "x").await;
    assert!(
        matches!(write, Err(ToolError::Validation(_))),
        "write {path:?}: {write:?}"
    );
}

/// Links `link` to the directory `target`; on Windows a junction, which needs no privilege.
#[cfg(unix)]
fn link_dir(target: &Path, link: &Path) -> io::Result<()> {
    use std::os::unix::fs::symlink;

    symlink(target, link)
}

#[cfg(windows)]
fn link_dir(target: &Path, link: &Path) -> io::Result<()> {
    use std::process::{Command, Stdio};

    let status = Command::new("cmd")
        .args(["/C", "mklink", "/J"])
        .arg(link)
        .arg(target)
        .stdout(Stdio::null())
        .status()?;
    if status.success() {
        Ok(())
    } else {
        Err(io::Error::other(format!("mklink /J exited with {status}")))
    }
}

#[tokio::test]
async fn paths_that_leave_the_root_are_rejected() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let env = workspace.env().await?;
    let outside = env::temp_dir().join(format!("outside-{}.txt", Uuid::new_v4()));

    for path in [
        outside.as_path(),
        Path::new("../x.txt"),
        Path::new("a/../../x.txt"),
    ] {
        assert_outside(&env, path).await;
    }
    assert!(!outside.exists(), "nothing is written outside the root");
    Ok(())
}

#[tokio::test]
async fn an_absolute_path_inside_the_root_is_accepted() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let env = workspace.env().await?;

    env.write_file(&workspace.0.join("notes").join("a.txt"), "hello")
        .await?;

    assert_eq!(
        env.read_file(Path::new("notes/a.txt")).await?,
        "hello",
        "read back through a relative path"
    );
    Ok(())
}

#[cfg(windows)]
#[tokio::test]
async fn a_root_spelled_in_another_letter_case_is_the_same_root() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let env = workspace.env().await?;
    let upper = PathBuf::from(env.root().to_string_lossy().to_uppercase());

    env.write_file(&upper.join("case.txt"), "x").await?;

    assert!(workspace.0.join("case.txt").exists(), "written in the root");
    Ok(())
}

#[tokio::test]
async fn links_that_leave_the_root_are_rejected() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let outside = Workspace::new()?;
    fs::write(outside.0.join("secret.txt"), "secret")?;
    fs::create_dir(outside.0.join("gone"))?;
    link_dir(&outside.0, &workspace.0.join("out"))?;
    link_dir(&outside.0.join("gone"), &workspace.0.join("dangling"))?;
    fs::remove_dir(outside.0.join("gone"))?;
    let env = workspace.env().await?;

    for path in ["out/secret.txt", "out/new.txt", "dangling"] {
        assert_outside(&env, Path::new(path)).await;
    }
    assert!(
        !outside.0.join("new.txt").exists() && !outside.0.join("gone").exists(),
        "nothing is written through a link"
    );
    Ok(())
}

#[tokio::test]
async fn a_write_creates_missing_directories_and_reads_back() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let env = workspace.env().await?;

    env.write_file(Path::new("./notes/./day/a.txt"), "hello")
        .await?;

    assert_eq!(
        fs::read_to_string(workspace.0.join("notes").join("day").join("a.txt"))?,
        "hello",
        "file under the root"
    );
    assert_eq!(
        env.read_file(Path::new("notes/day/a.txt")).await?,
        "hello",
        "read back"
    );
    Ok(())
}

#[tokio::test]
async fn file_system_failures_are_execution_errors() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let env = workspace.env().await?;
    env.write_file(Path::new("file.txt"), "x").await?;
    fs::create_dir(workspace.0.join("dir"))?;

    let missing = env.read_file(Path::new("missing.txt")).await;
    let below_file = env.write_file(Path::new("file.txt/inner.txt"), "x").await;
    let onto_dir = env.write_file(Path::new("dir"), "x").await;

    assert!(
        matches!(missing, Err(ToolError::Execution(_))),
        "{missing:?}"
    );
    assert!(
        matches!(below_file, Err(ToolError::Execution(_))),
        "{below_file:?}"
    );
    assert!(
        matches!(onto_dir, Err(ToolError::Execution(_))),
        "{onto_dir:?}"
    );
    Ok(())
}

#[tokio::test]
async fn an_environment_over_a_missing_root_fails_to_open() {
    let missing = env::temp_dir().join(format!("missing-{}", Uuid::new_v4()));

    let opened = LocalExecEnv::open(&missing, CancelToken::new()).await;

    assert!(opened.is_err(), "{opened:?}");
}

#[tokio::test]
async fn a_command_reports_its_exit_code_and_output() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let env = workspace.env().await?;

    let result = env
        .exec_command("echo out&& echo err 1>&2&& exit 3", Duration::from_secs(30))
        .await?;

    assert_eq!(result.exit_code, Some(3), "exit code");
    assert_eq!(result.stdout.trim(), "out", "stdout");
    assert_eq!(result.stderr.trim(), "err", "stderr");
    assert_eq!(result.stop, None, "ran to its end");
    Ok(())
}

#[tokio::test]
async fn a_command_runs_in_the_root() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let env = workspace.env().await?;
    env.write_file(Path::new("marker.txt"), "here").await?;
    let print = if cfg!(windows) {
        "type marker.txt"
    } else {
        "cat marker.txt"
    };

    let result = env.exec_command(print, Duration::from_secs(30)).await?;

    assert_eq!(
        (result.exit_code, result.stdout.as_str()),
        (Some(0), "here"),
        "{result:?}"
    );
    Ok(())
}

#[tokio::test]
async fn a_command_past_its_timeout_is_stopped_with_its_output_so_far() -> Result<(), Box<dyn Error>>
{
    let workspace = Workspace::new()?;
    let env = workspace.env().await?;
    let started = Instant::now();

    let ran = run(
        &registry(),
        &env,
        "bash",
        json!({ "command": STARTED_THEN_WAITS, "timeout": 1 }),
    )
    .await?;

    assert!(
        started.elapsed() < Duration::from_secs(30),
        "process tree stopped"
    );
    assert_eq!(ran["stopped"], "timed out after 1 s", "{ran}");
    assert_eq!(
        ran["stdout"].as_str().map(str::trim),
        Some("started"),
        "{ran}"
    );
    Ok(())
}

#[tokio::test]
async fn cancelling_the_turn_stops_a_running_command() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let cancel = CancelToken::new();
    let env = LocalExecEnv::open(&workspace.0, cancel.clone()).await?;
    tokio::spawn(async move {
        time::sleep(Duration::from_millis(500)).await;
        cancel.cancel();
    });

    let result = env
        .exec_command(STARTED_THEN_WAITS, Duration::from_secs(60))
        .await?;

    assert_eq!(result.stop, Some(CommandStop::Aborted), "{result:?}");
    assert_eq!(result.stdout.trim(), "started", "output so far");
    Ok(())
}

#[cfg(unix)]
#[tokio::test]
async fn a_command_that_ignores_sigterm_is_killed() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let env = workspace.env().await?;
    let started = Instant::now();

    let result = env
        .exec_command("trap '' TERM; sleep 60", Duration::from_secs(1))
        .await?;

    assert_eq!(
        result.stop,
        Some(CommandStop::TimedOut(Duration::from_secs(1))),
        "{result:?}"
    );
    assert!(
        started.elapsed() < Duration::from_secs(30),
        "killed after the grace period"
    );
    Ok(())
}

#[tokio::test]
async fn a_timeout_outside_its_range_fails_validation() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let env = workspace.env().await?;

    for timeout in [0, 3601] {
        let result = run(
            &registry(),
            &env,
            "bash",
            json!({ "command": "echo x", "timeout": timeout }),
        )
        .await;
        assert!(
            matches!(result, Err(ToolError::Validation(_))),
            "{timeout}: {result:?}"
        );
    }
    Ok(())
}

#[tokio::test]
async fn the_registry_offers_each_builtin_tool_under_its_spec_name() -> Result<(), Box<dyn Error>> {
    let registry = registry();

    let names: BTreeSet<String> = registry.specs().into_iter().map(|spec| spec.name).collect();

    assert_eq!(
        names,
        BTreeSet::from([
            "bash".to_owned(),
            "read_file".to_owned(),
            "write_file".to_owned()
        ]),
        "registered tool names"
    );
    for spec in registry.specs() {
        assert_eq!(
            spec.parameters["type"], "object",
            "{} parameters",
            spec.name
        );
        assert!(
            registry.get(&spec.name).is_some(),
            "{} is found under its spec name",
            spec.name
        );
    }
    assert!(registry.get("missing").is_none(), "unknown tool");
    Ok(())
}

#[tokio::test]
async fn the_tools_write_read_and_run_in_the_root() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let env = workspace.env().await?;
    let registry = registry();

    let written = run(
        &registry,
        &env,
        "write_file",
        json!({ "path": "a.txt", "content": "text" }),
    )
    .await?;
    let read = run(&registry, &env, "read_file", json!({ "path": "a.txt" })).await?;
    let ran = run(&registry, &env, "bash", json!({ "command": "echo ran" })).await?;

    assert_eq!(written, json!({ "success": true }), "write result");
    assert_eq!(read, json!("text"), "read result");
    assert_eq!(
        ran,
        json!({ "exit_code": 0, "stdout": ran["stdout"], "stderr": "" }),
        "bash result without a stop"
    );
    assert_eq!(
        ran["stdout"].as_str().map(str::trim),
        Some("ran"),
        "bash stdout"
    );
    Ok(())
}

#[tokio::test]
async fn arguments_that_miss_a_parameter_fail_validation() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let env = workspace.env().await?;
    let registry = registry();

    for (name, args) in [
        ("bash", json!({})),
        ("read_file", json!({ "file": "a.txt" })),
        ("write_file", json!({ "path": "a.txt" })),
    ] {
        let result = run(&registry, &env, name, args).await;
        let Err(error) = result else {
            return Err(format!("{name} accepted invalid arguments").into());
        };
        assert!(
            error.to_string().starts_with("validation error: "),
            "{name}: {error}"
        );
    }
    Ok(())
}

#[tokio::test]
async fn an_execution_error_tells_the_model_what_failed() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let env = workspace.env().await?;
    fs::create_dir(workspace.0.join("dir"))?;
    let removed = Workspace::new()?;
    let without_root = removed.env().await?;
    fs::remove_dir_all(&removed.0)?;
    let registry = registry();

    let cases = [
        (
            run(
                &registry,
                &env,
                "read_file",
                json!({ "path": "missing.txt" }),
            )
            .await,
            "execution error: read missing.txt: ",
        ),
        (
            run(
                &registry,
                &env,
                "write_file",
                json!({ "path": "dir", "content": "x" }),
            )
            .await,
            "execution error: write dir: ",
        ),
        (
            run(
                &registry,
                &without_root,
                "bash",
                json!({ "command": "echo out" }),
            )
            .await,
            "execution error: spawn command: ",
        ),
    ];

    for (result, prefix) in cases {
        let Err(error) = result else {
            return Err(format!("expected {prefix}, got {result:?}").into());
        };
        assert!(error.to_string().starts_with(prefix), "{error}");
    }
    Ok(())
}
