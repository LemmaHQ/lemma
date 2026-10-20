use std::sync::Arc;

use lemma_core::ToolCall;
use lemma_tools::{ApprovalDecision, ApprovalPolicy, ExecEnv, ToolRegistry};

/// Tool execution wiring available to the loop: registry, environment and
/// an optional approval gate.
pub struct ToolRuntime {
    /// Tools advertised to the model and dispatched on calls.
    pub registry: ToolRegistry,
    /// Environment tool executions run inside.
    pub env: Arc<dyn ExecEnv>,
    /// Optional approval gate consulted before every execution.
    pub approval: Option<Arc<dyn ApprovalPolicy>>,
}

impl ToolRuntime {
    /// Creates a runtime executing turns autonomously.
    pub fn new(registry: ToolRegistry, env: Arc<dyn ExecEnv>) -> Self {
        Self {
            registry,
            env,
            approval: None,
        }
    }

    /// Executes one tool call through the approval gate and registry,
    /// returning the result text and whether it represents a failure.
    pub(crate) async fn run(&self, call: &ToolCall) -> (String, bool) {
        let Some(tool) = self.registry.get(&call.name) else {
            return (format!("tool not found: {}", call.name), true);
        };
        if let Some(policy) = &self.approval {
            match policy.evaluate(&call.name, tool.tier(), &call.arguments) {
                ApprovalDecision::Allow => {}
                ApprovalDecision::Prompt(reason) => {
                    return (format!("tool call requires approval: {reason}"), true);
                }
                ApprovalDecision::Deny(reason) => {
                    return (format!("tool call denied: {reason}"), true);
                }
            }
        }
        match tool
            .execute(call.arguments.clone(), self.env.as_ref())
            .await
        {
            Ok(value) => match serde_json::to_string_pretty(&value) {
                Ok(text) => (text, false),
                Err(_) => (value.to_string(), false),
            },
            Err(e) => (e.to_string(), true),
        }
    }
}
