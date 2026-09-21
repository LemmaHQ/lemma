use std::path::Path;

use crate::env::ExecEnv;
use crate::error::ToolError;
use crate::tool::{BoxToolFuture, Tool, ToolSpec};

/// Tool for reading file contents from the workspace sandbox.
pub struct ReadFileTool;

impl Tool for ReadFileTool {
    fn spec(&self) -> ToolSpec {
        ToolSpec {
            name: "read_file".to_string(),
            description: "Reads the complete contents of a file at the specified path.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Workspace-relative file path."
                    }
                },
                "required": ["path"]
            }),
        }
    }

    fn execute<'a>(&'a self, args: serde_json::Value, env: &'a dyn ExecEnv) -> BoxToolFuture<'a> {
        Box::pin(async move {
            let path_str = args.get("path").and_then(|v| v.as_str()).ok_or_else(|| {
                ToolError::Validation("missing required 'path' argument".to_string())
            })?;
            let content = env.read_file(Path::new(path_str)).await?;
            Ok(serde_json::Value::String(content))
        })
    }
}

/// Tool for creating or overwriting files in the workspace sandbox.
pub struct WriteFileTool;

impl Tool for WriteFileTool {
    fn spec(&self) -> ToolSpec {
        ToolSpec {
            name: "write_file".to_string(),
            description: "Creates or overwrites a file at the specified path with content."
                .to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Workspace-relative file path."
                    },
                    "content": {
                        "type": "string",
                        "description": "Text content to write."
                    }
                },
                "required": ["path", "content"]
            }),
        }
    }

    fn execute<'a>(&'a self, args: serde_json::Value, env: &'a dyn ExecEnv) -> BoxToolFuture<'a> {
        Box::pin(async move {
            let path_str = args.get("path").and_then(|v| v.as_str()).ok_or_else(|| {
                ToolError::Validation("missing required 'path' argument".to_string())
            })?;
            let content = args
                .get("content")
                .and_then(|v| v.as_str())
                .ok_or_else(|| {
                    ToolError::Validation("missing required 'content' argument".to_string())
                })?;

            env.write_file(Path::new(path_str), content).await?;
            Ok(serde_json::json!({ "success": true }))
        })
    }
}

/// Tool for executing shell commands in the workspace sandbox.
pub struct BashTool;

impl Tool for BashTool {
    fn spec(&self) -> ToolSpec {
        ToolSpec {
            name: "bash".to_string(),
            description: "Runs a shell command inside the workspace sandbox.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The command string to execute."
                    }
                },
                "required": ["command"]
            }),
        }
    }

    fn execute<'a>(&'a self, args: serde_json::Value, env: &'a dyn ExecEnv) -> BoxToolFuture<'a> {
        Box::pin(async move {
            let cmd = args
                .get("command")
                .and_then(|v| v.as_str())
                .ok_or_else(|| {
                    ToolError::Validation("missing required 'command' argument".to_string())
                })?;

            let res = env.exec_command(cmd, None).await?;
            Ok(serde_json::json!({
                "exit_code": res.exit_code,
                "stdout": res.stdout,
                "stderr": res.stderr,
            }))
        })
    }
}
