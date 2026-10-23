use std::fmt::Debug;

use serde_json::Value;

use crate::tool::ToolTier;

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
pub trait ApprovalPolicy: Debug + Send + Sync {
    /// Evaluates an execution attempt against safety policy.
    fn evaluate(&self, tool_name: &str, tier: ToolTier, args: &Value) -> ApprovalDecision;
}
