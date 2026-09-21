use std::fmt;

/// Errors produced during agent execution and storage operations.
#[derive(Debug)]
pub enum AgentError {
    /// Failure communicating with the upstream model provider.
    Provider(String),
    /// Failure persisting or querying the underlying trace store.
    Store(String),
    /// The conversation or targeted message node does not exist.
    NotFound(String),
    /// Invalid argument or malformed message structure.
    InvalidInput(String),
}

impl fmt::Display for AgentError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Provider(e) => write!(f, "provider error: {e}"),
            Self::Store(e) => write!(f, "store error: {e}"),
            Self::NotFound(e) => write!(f, "not found: {e}"),
            Self::InvalidInput(e) => write!(f, "invalid input: {e}"),
        }
    }
}

impl std::error::Error for AgentError {}

impl From<lemma_adapter::ProviderError> for AgentError {
    fn from(err: lemma_adapter::ProviderError) -> Self {
        Self::Provider(err.message)
    }
}

impl From<lemma_session::SessionError> for AgentError {
    fn from(err: lemma_session::SessionError) -> Self {
        match err {
            lemma_session::SessionError::Store(e) => Self::Store(e),
            lemma_session::SessionError::NotFound(e) => Self::NotFound(e),
        }
    }
}
