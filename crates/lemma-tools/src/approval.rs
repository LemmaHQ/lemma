/// Capability tier of a tool, determining its default approval behavior.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolTier {
    /// Read-only inspection (file read, directory listing).
    Read,
    /// State-mutating operations (file write, deletion).
    Write,
    /// Arbitrary command execution.
    Exec,
}

/// The decision made by an approval policy for a specific tool call.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ApprovalDecision {
    /// Proceed with execution automatically.
    Allow,
    /// Prompt the operator for explicit confirmation before running.
    Prompt(String),
    /// Silently reject the tool execution.
    Deny(String),
}

/// Safety policy governing tool execution permissions.
pub trait ApprovalPolicy: Send + Sync {
    /// Evaluates an execution attempt against the configured security posture.
    fn evaluate(
        &self,
        tool_name: &str,
        tier: ToolTier,
        args: &serde_json::Value,
    ) -> ApprovalDecision;
}
