use std::fmt;

/// Failure that ends a turn.
#[derive(Debug)]
pub enum LoopError {
    /// The model stream failed; the step's placeholder carries the message.
    Model(String),
    /// The trace store failed.
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

impl From<lemma_session::SessionError> for LoopError {
    fn from(err: lemma_session::SessionError) -> Self {
        match err {
            lemma_session::SessionError::Store(e) => Self::Store(e),
            lemma_session::SessionError::NotFound(e) => Self::NotFound(e),
        }
    }
}
