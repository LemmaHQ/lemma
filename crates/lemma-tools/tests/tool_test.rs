#![allow(clippy::unwrap_used, missing_docs)]

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use lemma_tools::{
    ApprovalDecision, ApprovalPolicy, BashTool, BoxEnvFuture, ExecCommandResult, ExecEnv, FileMeta,
    ReadFileTool, ToolError, ToolRegistry, ToolTier, WriteFileTool,
};
use parking_lot::Mutex;

struct MemoryEnv {
    files: Mutex<HashMap<PathBuf, String>>,
}

impl MemoryEnv {
    fn new() -> Self {
        Self {
            files: Mutex::new(HashMap::new()),
        }
    }
}

impl ExecEnv for MemoryEnv {
    fn read_file<'a>(&'a self, path: &'a Path) -> BoxEnvFuture<'a, String> {
        Box::pin(async move {
            self.files
                .lock()
                .get(path)
                .cloned()
                .ok_or_else(|| ToolError::Execution("file not found".to_string()))
        })
    }

    fn write_file<'a>(&'a self, path: &'a Path, content: &'a str) -> BoxEnvFuture<'a, ()> {
        Box::pin(async move {
            self.files
                .lock()
                .insert(path.to_path_buf(), content.to_string());
            Ok(())
        })
    }

    fn list_dir<'a>(&'a self, _path: &'a Path) -> BoxEnvFuture<'a, Vec<FileMeta>> {
        Box::pin(async move {
            let list = self
                .files
                .lock()
                .keys()
                .map(|p| FileMeta {
                    name: p.to_string_lossy().to_string(),
                    is_dir: false,
                    size: 0,
                })
                .collect();
            Ok(list)
        })
    }

    fn exec_command<'a>(
        &'a self,
        command: &'a str,
        _cwd: Option<&'a Path>,
    ) -> BoxEnvFuture<'a, ExecCommandResult> {
        Box::pin(async move {
            Ok(ExecCommandResult {
                exit_code: 0,
                stdout: format!("ran: {command}"),
                stderr: String::new(),
            })
        })
    }
}

struct AllowAllPolicy;

impl ApprovalPolicy for AllowAllPolicy {
    fn evaluate(
        &self,
        _tool_name: &str,
        _tier: ToolTier,
        _args: &serde_json::Value,
    ) -> ApprovalDecision {
        ApprovalDecision::Allow
    }
}
#[tokio::test]
async fn tools_register_and_execute_within_env() {
    let _policy = AllowAllPolicy;
    let mut registry = ToolRegistry::new();
    registry.register(Arc::new(ReadFileTool));
    registry.register(Arc::new(WriteFileTool));
    registry.register(Arc::new(BashTool));

    assert_eq!(registry.specs().len(), 3);

    let env = MemoryEnv::new();

    // 1. Write file
    let write_tool = registry.get("write_file").unwrap();
    let write_res = write_tool
        .execute(
            serde_json::json!({ "path": "test.txt", "content": "hello world" }),
            &env,
        )
        .await
        .unwrap();
    assert_eq!(write_res["success"], true);

    // 2. Read file
    let read_tool = registry.get("read_file").unwrap();
    let read_res = read_tool
        .execute(serde_json::json!({ "path": "test.txt" }), &env)
        .await
        .unwrap();
    assert_eq!(read_res.as_str().unwrap(), "hello world");

    // 3. Exec bash
    let bash_tool = registry.get("bash").unwrap();
    let bash_res = bash_tool
        .execute(serde_json::json!({ "command": "echo test" }), &env)
        .await
        .unwrap();
    assert_eq!(bash_res["stdout"].as_str().unwrap(), "ran: echo test");
}
