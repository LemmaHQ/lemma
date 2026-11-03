//! The builtin tools and `LocalExecEnv` against a real temporary workspace.

use std::collections::BTreeSet;
use std::env;
use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};

use lemma_tool::{
    BashTool, ExecEnv, LocalExecEnv, ReadFileTool, ToolError, ToolRegistry, WriteFileTool,
};
use serde_json::{Value, json};
use uuid::Uuid;

struct Workspace(PathBuf);

impl Workspace {
    fn new() -> Result<Self, Box<dyn Error>> {
        let root = env::temp_dir().join(format!("lemma-tool-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&root)?;
        Ok(Self(root))
    }

    fn env(&self) -> LocalExecEnv {
        LocalExecEnv::new(self.0.clone())
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

#[tokio::test]
async fn paths_that_leave_the_workspace_are_rejected() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let env = workspace.env();
    let outside = env::temp_dir().join("outside.txt");

    for path in [
        outside.as_path(),
        Path::new("../x.txt"),
        Path::new("a/../../x.txt"),
    ] {
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
    assert!(
        !outside.exists(),
        "nothing is written outside the workspace"
    );
    Ok(())
}

#[tokio::test]
async fn a_write_creates_missing_directories_and_reads_back() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let env = workspace.env();

    env.write_file(Path::new("./notes/./day/a.txt"), "hello")
        .await?;

    assert_eq!(
        fs::read_to_string(workspace.0.join("notes").join("day").join("a.txt"))?,
        "hello",
        "file under the workspace root"
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
    let env = workspace.env();
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
async fn a_command_reports_its_exit_code_and_output() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let env = workspace.env();

    let result = env
        .exec_command("echo out&& echo err 1>&2&& exit 3")
        .await?;

    assert_eq!(result.exit_code, 3, "exit code");
    assert_eq!(result.stdout.trim(), "out", "stdout");
    assert_eq!(result.stderr.trim(), "err", "stderr");
    Ok(())
}

#[tokio::test]
async fn a_command_runs_in_the_workspace_root() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let env = workspace.env();
    env.write_file(Path::new("marker.txt"), "here").await?;
    let print = if cfg!(windows) {
        "type marker.txt"
    } else {
        "cat marker.txt"
    };

    let result = env.exec_command(print).await?;

    assert_eq!(
        (result.exit_code, result.stdout.as_str()),
        (0, "here"),
        "{result:?}"
    );
    Ok(())
}

#[tokio::test]
async fn a_command_without_a_workspace_directory_fails_to_start() -> Result<(), Box<dyn Error>> {
    let env = LocalExecEnv::new(env::temp_dir().join(format!("missing-{}", Uuid::new_v4())));

    let result = env.exec_command("echo out").await;

    assert!(matches!(result, Err(ToolError::Execution(_))), "{result:?}");
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
async fn the_tools_write_read_and_run_in_the_workspace() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let env = workspace.env();
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
    assert_eq!(ran["exit_code"], 0, "bash exit code");
    assert_eq!(
        ran["stdout"].as_str().map(str::trim),
        Some("ran"),
        "bash stdout"
    );
    assert_eq!(ran["stderr"], "", "bash stderr");
    Ok(())
}

#[tokio::test]
async fn arguments_that_miss_a_parameter_fail_validation() -> Result<(), Box<dyn Error>> {
    let workspace = Workspace::new()?;
    let env = workspace.env();
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
    let env = workspace.env();
    fs::create_dir(workspace.0.join("dir"))?;
    let without_workspace =
        LocalExecEnv::new(env::temp_dir().join(format!("missing-{}", Uuid::new_v4())));
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
                &without_workspace,
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
