use lemma_session::SessionError;
use thiserror::Error;

/// Failure that ends a turn.
#[derive(Debug, Error)]
pub enum LoopError {
    /// The model stream failed; the step's placeholder carries the message.
    #[error("model error: {0}")]
    Model(String),
    /// The session database failed.
    #[error("store error: {0}")]
    Store(String),
    /// The session or a message on its path is absent.
    #[error("not found: {0}")]
    NotFound(String),
}

impl From<SessionError> for LoopError {
    fn from(err: SessionError) -> Self {
        match err {
            SessionError::Missing(e) => Self::NotFound(e),
            other => Self::Store(other.to_string()),
        }
    }
}
