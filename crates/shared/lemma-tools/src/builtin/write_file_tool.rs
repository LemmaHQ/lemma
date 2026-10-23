use std::path::Path;

use lemma_core::ToolSpec;
use serde::Deserialize;
use serde_json::{Value, json};

use crate::exec_env::ExecEnv;
use crate::tool::{BoxToolFuture, Tool, ToolTier};
use crate::tool_error::ToolError;

#[derive(Deserialize)]
struct WriteFileArgs {
    path: String,
    content: String,
}

/// Tool for creating or overwriting files in workspace sandbox.
#[derive(Debug)]
pub struct WriteFileTool;

impl<E: ExecEnv> Tool<E> for WriteFileTool {
    fn spec(&self) -> ToolSpec {
        ToolSpec {
            name: "write_file".to_string(),
            description: "Creates or overwrites a file at the specified path with content."
                .to_string(),
            parameters: json!({
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

    fn execute<'exec>(&'exec self, args: Value, env: &'exec E) -> BoxToolFuture<'exec> {
        Box::pin(async move {
            let parsed: WriteFileArgs =
                serde_json::from_value(args).map_err(|e| ToolError::Validation(e.to_string()))?;
            env.write_file(Path::new(&parsed.path), &parsed.content)
                .await?;
            Ok(json!({ "success": true }))
        })
    }
}
