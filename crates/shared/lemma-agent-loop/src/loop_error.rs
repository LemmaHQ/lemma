use std::error::Error;
use std::fmt;

use lemma_conversation::ConversationError;

/// Failure that ends a turn.
#[derive(Debug)]
pub enum LoopError {
    /// The model stream failed; the step's placeholder carries the message.
    Model(String),
    /// The conversation store failed.
    Store(String),
    /// The conversation or a message on its path is absent.
    NotFound(String),
}

impl fmt::Display for LoopError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Model(e) => write!(f, "model error: {e}"),
            Self::Store(e) => write!(f, "store error: {e}"),
            Self::NotFound(e) => write!(f, "not found: {e}"),
        }
    }
}

impl Error for LoopError {}

impl From<ConversationError> for LoopError {
    fn from(err: ConversationError) -> Self {
        match err {
            ConversationError::Store(e) => Self::Store(e),
            ConversationError::Missing(e) => Self::NotFound(e),
            other => Self::Store(other.to_string()),
        }
    }
}
