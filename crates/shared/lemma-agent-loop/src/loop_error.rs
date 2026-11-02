use lemma_conversation::ConversationError;
use thiserror::Error;

/// Failure that ends a turn.
#[derive(Debug, Error)]
pub enum LoopError {
    /// The model stream failed; the step's placeholder carries the message.
    #[error("model error: {0}")]
    Model(String),
    /// The conversation database failed.
    #[error("store error: {0}")]
    Store(String),
    /// The conversation or a message on its path is absent.
    #[error("not found: {0}")]
    NotFound(String),
}

impl From<ConversationError> for LoopError {
    fn from(err: ConversationError) -> Self {
        match err {
            ConversationError::Missing(e) => Self::NotFound(e),
            other => Self::Store(other.to_string()),
        }
    }
}
