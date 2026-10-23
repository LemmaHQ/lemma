use std::error::Error;
use std::fmt;

/// Any model call failure, reduced to a message.
#[derive(Debug)]
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

impl fmt::Display for ModelError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl Error for ModelError {}
