use serde::Deserialize;

use crate::approval::ToolTier;
use crate::env::ExecEnv;
use crate::error::ToolError;
use crate::tool::{BoxToolFuture, Tool, ToolSpec};

#[derive(Deserialize)]
struct BashArgs {
    command: String,
}

/// Tool for executing shell commands in workspace sandbox.
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

    fn tier(&self) -> ToolTier {
        ToolTier::Exec
    }

    fn execute<'a>(&'a self, args: serde_json::Value, env: &'a dyn ExecEnv) -> BoxToolFuture<'a> {
        Box::pin(async move {
            let parsed: BashArgs =
                serde_json::from_value(args).map_err(|e| ToolError::Validation(e.to_string()))?;
            let res = env.exec_command(&parsed.command, None).await?;
            Ok(serde_json::json!({
                "exit_code": res.exit_code,
                "stdout": res.stdout,
                "stderr": res.stderr,
            }))
        })
    }
}
