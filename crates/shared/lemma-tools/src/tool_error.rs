use thiserror::Error;

/// Errors produced during tool argument validation and execution.
#[derive(Debug, Error)]
pub enum ToolError {
    /// Failure during tool argument validation.
    #[error("validation error: {0}")]
    Validation(String),
    /// Failure encountered within the execution environment.
    #[error("execution error: {0}")]
    Execution(String),
}
