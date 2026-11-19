use std::time::Duration;

use lemma_core::ToolSpec;
use serde::Deserialize;
use serde_json::{Value, json};

use crate::exec_env::ExecEnv;
use crate::tool::{BoxToolFuture, Tool};
use crate::tool_error::ToolError;

const DEFAULT_TIMEOUT_SECS: u64 = 300;
const MAX_TIMEOUT_SECS: u64 = 3600;

#[derive(Deserialize)]
struct BashArgs {
    command: String,
    #[serde(default = "default_timeout")]
    timeout: u64,
}

fn default_timeout() -> u64 {
    DEFAULT_TIMEOUT_SECS
}

/// Tool that runs a shell command in the session directory.
#[derive(Debug)]
pub struct BashTool;

impl<E: ExecEnv> Tool<E> for BashTool {
    fn spec(&self) -> ToolSpec {
        ToolSpec {
            name: "bash".to_string(),
            description: "Runs a shell command, starting in the session directory. Output keeps \
                          the first and last 16 KB of each stream."
                .to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The command string to execute."
                    },
                    "timeout": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": MAX_TIMEOUT_SECS,
                        "description": format!(
                            "Seconds before the command is stopped; default {DEFAULT_TIMEOUT_SECS}."
                        )
                    }
                },
                "required": ["command"]
            }),
        }
    }

    fn execute<'exec>(&'exec self, args: Value, env: &'exec E) -> BoxToolFuture<'exec> {
        Box::pin(async move {
            let parsed: BashArgs =
                serde_json::from_value(args).map_err(|e| ToolError::Validation(e.to_string()))?;
            if !(1..=MAX_TIMEOUT_SECS).contains(&parsed.timeout) {
                return Err(ToolError::Validation(format!(
                    "timeout must be from 1 to {MAX_TIMEOUT_SECS} seconds"
                )));
            }
            let timeout = Duration::from_secs(parsed.timeout);
            let res = env.exec_command(&parsed.command, timeout).await?;
            let mut output = json!({
                "exit_code": res.exit_code,
                "stdout": res.stdout,
                "stderr": res.stderr,
            });
            if let Some(stop) = res.stop {
                output["stopped"] = Value::String(stop.to_string());
            }
            Ok(output)
        })
    }
}
