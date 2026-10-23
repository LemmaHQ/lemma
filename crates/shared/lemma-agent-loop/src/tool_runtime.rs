use lemma_core::ToolCall;
use lemma_tools::{ApprovalDecision, ApprovalPolicy, ExecEnv, ToolRegistry};

/// Tool execution wiring available to the loop: registry, environment and
/// an optional approval gate.
#[derive(Debug)]
pub struct ToolRuntime<E> {
    /// Tools advertised to the model and dispatched on calls.
    pub registry: ToolRegistry<E>,
    /// Environment tool executions run inside.
    pub env: E,
    /// Optional approval gate consulted before every execution.
    pub approval: Option<Box<dyn ApprovalPolicy>>,
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
        Self {
            registry,
            env,
            approval: None,
        }
    }

    /// Executes one tool call through the approval gate and registry.
    pub(crate) async fn run(&self, call: &ToolCall) -> ToolOutcome {
        let Some(tool) = self.registry.get(&call.name) else {
            return ToolOutcome::error(format!("tool not found: {}", call.name));
        };
        if let Some(policy) = &self.approval {
            match policy.evaluate(&call.name, tool.tier(), &call.arguments) {
                ApprovalDecision::Allow => {}
                ApprovalDecision::Prompt(reason) => {
                    return ToolOutcome::error(format!("tool call requires approval: {reason}"));
                }
                ApprovalDecision::Deny(reason) => {
                    return ToolOutcome::error(format!("tool call denied: {reason}"));
                }
            }
        }
        match tool.execute(call.arguments.clone(), &self.env).await {
            Ok(value) => ToolOutcome {
                text: serde_json::to_string_pretty(&value).unwrap_or_else(|_| value.to_string()),
                is_error: false,
            },
            Err(e) => ToolOutcome::error(e.to_string()),
        }
    }
}
