use lemma_core::ToolSpec;
use serde::Deserialize;
use serde_json::{Value, json};

use crate::exec_env::ExecEnv;
use crate::tool::{BoxToolFuture, Tool, ToolTier};
use crate::tool_error::ToolError;

#[derive(Deserialize)]
struct BashArgs {
    command: String,
}

/// Tool for executing shell commands in workspace sandbox.
#[derive(Debug)]
pub struct BashTool;

impl<E: ExecEnv> Tool<E> for BashTool {
    fn spec(&self) -> ToolSpec {
        ToolSpec {
            name: "bash".to_string(),
            description: "Runs a shell command inside the workspace sandbox.".to_string(),
            parameters: json!({
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

    fn execute<'exec>(&'exec self, args: Value, env: &'exec E) -> BoxToolFuture<'exec> {
        Box::pin(async move {
            let parsed: BashArgs =
                serde_json::from_value(args).map_err(|e| ToolError::Validation(e.to_string()))?;
            let res = env.exec_command(&parsed.command, None).await?;
            Ok(json!({
                "exit_code": res.exit_code,
                "stdout": res.stdout,
                "stderr": res.stderr,
            }))
        })
    }
}
