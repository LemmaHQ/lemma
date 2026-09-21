use std::fmt;

/// Errors produced during tool discovery, argument validation, and execution.
#[derive(Debug)]
pub enum ToolError {
    /// Failure during tool argument validation against its parameter schema.
    Validation(String),
    /// Execution denied by safety approval gate.
    PermissionDenied(String),
    /// Failure encountered within the execution environment (e.g. I/O, process exit).
    Execution(String),
    /// Tool not found in the registry.
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
