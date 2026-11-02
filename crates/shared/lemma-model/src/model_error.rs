use thiserror::Error;

/// Any model call failure, reduced to a message.
#[derive(Debug, Error)]
#[error("{message}")]
pub struct ModelError {
    /// Human-readable failure description.
    pub message: String,
}

impl ModelError {
    /// Creates an error carrying `message`.
    #[must_use]
    pub fn new(message: String) -> Self {
        Self { message }
    }
}
