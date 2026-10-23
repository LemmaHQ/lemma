use std::fmt;

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

impl std::error::Error for LoopError {}

impl From<lemma_conversation::ConversationError> for LoopError {
    fn from(err: lemma_conversation::ConversationError) -> Self {
        match err {
            lemma_conversation::ConversationError::Store(e) => Self::Store(e),
            lemma_conversation::ConversationError::Missing(e) => Self::NotFound(e),
            other => Self::Store(other.to_string()),
        }
    }
}
