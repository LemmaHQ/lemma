/// Capability tier of a tool.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolTier {
    /// Read-only inspection.
    Read,
    /// State-mutating operation.
    Write,
    /// Command execution.
    Exec,
}

/// Decision made by an approval policy.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ApprovalDecision {
    /// Proceed with execution.
    Allow,
    /// Prompt operator for confirmation.
    Prompt(String),
    /// Reject the execution.
    Deny(String),
}

/// Safety policy governing tool permissions.
pub trait ApprovalPolicy: Send + Sync {
    /// Evaluates an execution attempt against safety policy.
    fn evaluate(
        &self,
        tool_name: &str,
        tier: ToolTier,
        args: &serde_json::Value,
    ) -> ApprovalDecision;
}
