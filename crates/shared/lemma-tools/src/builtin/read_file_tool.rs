use std::path::Path;

use lemma_core::ToolSpec;
use serde::Deserialize;
use serde_json::{Value, json};

use crate::exec_env::ExecEnv;
use crate::tool::{BoxToolFuture, Tool, ToolTier};
use crate::tool_error::ToolError;

#[derive(Deserialize)]
struct ReadFileArgs {
    path: String,
}

/// Tool for reading file contents from workspace sandbox.
#[derive(Debug)]
pub struct ReadFileTool;

impl<E: ExecEnv> Tool<E> for ReadFileTool {
    fn spec(&self) -> ToolSpec {
        ToolSpec {
            name: "read_file".to_string(),
            description: "Reads the complete contents of a file at the specified path.".to_string(),
            parameters: json!({
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

    fn execute<'exec>(&'exec self, args: Value, env: &'exec E) -> BoxToolFuture<'exec> {
        Box::pin(async move {
            let parsed: ReadFileArgs =
                serde_json::from_value(args).map_err(|e| ToolError::Validation(e.to_string()))?;
            let content = env.read_file(Path::new(&parsed.path)).await?;
            Ok(Value::String(content))
        })
    }
}
