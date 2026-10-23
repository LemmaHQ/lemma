use std::error::Error;
use std::{fmt, io};

/// Errors produced during tool argument validation and execution.
#[derive(Debug)]
pub enum ToolError {
    /// Failure during tool argument validation.
    Validation(String),
    /// Failure encountered within the execution environment.
    Execution(String),
}

impl fmt::Display for ToolError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Validation(e) => write!(f, "validation error: {e}"),
            Self::Execution(e) => write!(f, "execution error: {e}"),
        }
    }
}

impl Error for ToolError {}

impl From<io::Error> for ToolError {
    fn from(error: io::Error) -> Self {
        Self::Execution(error.to_string())
    }
}
