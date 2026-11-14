use lemma_provider::ProviderError;
use lemma_session::SessionError;
use thiserror::Error;

/// Failure starting a turn before background execution begins.
#[derive(Debug, Error)]
pub enum AgentError {
    /// The message content is empty after trimming.
    #[error("content required")]
    ContentRequired,
    /// The model id is empty after trimming.
    #[error("model required")]
    ModelRequired,
    /// The provider is absent.
    #[error("provider not found")]
    ProviderNotFound,
    /// The provider domain failed, e.g. opening the API key.
    #[error("provider: {0}")]
    Provider(ProviderError),
    /// The session is absent.
    #[error("session not found")]
    SessionNotFound,
    /// Target message is absent from the session.
    #[error("message not found")]
    MessageNotFound,
    /// Target message cannot serve as a branch parent.
    #[error("invalid branch point")]
    InvalidBranchPoint,
    /// The session already has a running turn.
    #[error("session already has a running turn")]
    SessionBusy,
    /// The session database failed.
    #[error("store: {0}")]
    Store(String),
    /// The directory the session is bound to no longer exists.
    #[error("directory not found: {0}")]
    DirectoryNotFound(String),
    /// The session's generated workspace could not be created.
    #[error("create workspace: {0}")]
    Workspace(String),
}

impl From<ProviderError> for AgentError {
    fn from(err: ProviderError) -> Self {
        match err {
            ProviderError::NotFound => Self::ProviderNotFound,
            other => Self::Provider(other),
        }
    }
}

impl From<SessionError> for AgentError {
    fn from(err: SessionError) -> Self {
        match err {
            SessionError::NotFound => Self::SessionNotFound,
            SessionError::MessageNotFound => Self::MessageNotFound,
            SessionError::InvalidBranchPoint => Self::InvalidBranchPoint,
            SessionError::DirectoryNotFound(dir) => Self::DirectoryNotFound(dir),
            other @ (SessionError::TitleRequired
            | SessionError::Missing(_)
            | SessionError::Store(_)) => Self::Store(other.to_string()),
        }
    }
}
