use std::path::Path;

use serde::Deserialize;

use crate::approval::ToolTier;
use crate::env::ExecEnv;
use crate::error::ToolError;
use crate::tool::{BoxToolFuture, Tool, ToolSpec};

#[derive(Deserialize)]
struct ReadFileArgs {
    path: String,
}

/// Tool for reading file contents from workspace sandbox.
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

    fn tier(&self) -> ToolTier {
        ToolTier::Read
    }

    fn execute<'a>(&'a self, args: serde_json::Value, env: &'a dyn ExecEnv) -> BoxToolFuture<'a> {
        Box::pin(async move {
            let parsed: ReadFileArgs =
                serde_json::from_value(args).map_err(|e| ToolError::Validation(e.to_string()))?;
            let content = env.read_file(Path::new(&parsed.path)).await?;
            Ok(serde_json::Value::String(content))
        })
    }
}

#[derive(Deserialize)]
struct WriteFileArgs {
    path: String,
    content: String,
}

/// Tool for creating or overwriting files in workspace sandbox.
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

    fn tier(&self) -> ToolTier {
        ToolTier::Write
    }

    fn execute<'a>(&'a self, args: serde_json::Value, env: &'a dyn ExecEnv) -> BoxToolFuture<'a> {
        Box::pin(async move {
            let parsed: WriteFileArgs =
                serde_json::from_value(args).map_err(|e| ToolError::Validation(e.to_string()))?;
            env.write_file(Path::new(&parsed.path), &parsed.content)
                .await?;
            Ok(serde_json::json!({ "success": true }))
        })
    }
}
