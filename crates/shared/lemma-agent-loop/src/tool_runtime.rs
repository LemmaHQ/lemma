use lemma_core::ToolCall;
use lemma_tools::{ExecEnv, ToolRegistry};

/// Tool execution wiring available to the loop.
#[derive(Debug)]
pub struct ToolRuntime<E> {
    /// Tools advertised to the model and dispatched on calls.
    pub registry: ToolRegistry<E>,
    /// Environment tool executions run inside.
    pub env: E,
}

/// Result text of one tool call.
pub(crate) struct ToolOutcome {
    pub(crate) text: String,
    pub(crate) is_error: bool,
}

impl ToolOutcome {
    fn error(text: String) -> Self {
        Self {
            text,
            is_error: true,
        }
    }
}

impl<E: ExecEnv> ToolRuntime<E> {
    /// Creates a runtime executing turns autonomously.
    pub fn new(registry: ToolRegistry<E>, env: E) -> Self {
        Self { registry, env }
    }

    /// Executes one tool call through the registry.
    pub(crate) async fn run(&self, call: &ToolCall) -> ToolOutcome {
        let Some(tool) = self.registry.get(&call.name) else {
            return ToolOutcome::error(format!("tool not found: {}", call.name));
        };
        match tool.execute(call.arguments.clone(), &self.env).await {
            Ok(value) => ToolOutcome {
                text: serde_json::to_string_pretty(&value).unwrap_or_else(|_| value.to_string()),
                is_error: false,
            },
            Err(e) => ToolOutcome::error(e.to_string()),
        }
    }
}
