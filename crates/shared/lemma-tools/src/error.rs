use std::fmt;

/// Errors produced during tool discovery, argument validation, and execution.
#[derive(Debug)]
pub enum ToolError {
    /// Failure during tool argument validation.
    Validation(String),
    /// Execution denied by approval policy.
    PermissionDenied(String),
    /// Failure encountered within the execution environment.
    Execution(String),
    /// Tool not found in registry.
    NotFound(String),
}

impl fmt::Display for ToolError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Validation(e) => write!(f, "validation error: {e}"),
            Self::PermissionDenied(e) => write!(f, "permission denied: {e}"),
            Self::Execution(e) => write!(f, "execution error: {e}"),
            Self::NotFound(e) => write!(f, "tool not found: {e}"),
        }
    }
}

impl std::error::Error for ToolError {}

impl From<std::io::Error> for ToolError {
    fn from(error: std::io::Error) -> Self {
        Self::Execution(error.to_string())
    }
}
