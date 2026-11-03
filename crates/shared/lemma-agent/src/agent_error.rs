use lemma_agent_loop::LoopError;
use lemma_provider::ProviderError;
use thiserror::Error;

/// Failure preparing or running a turn.
#[derive(Debug, Error)]
pub enum AgentError {
    /// The message content is empty after trimming.
    #[error("content required")]
    ContentRequired,
    /// The model id is empty after trimming.
    #[error("model required")]
    ModelRequired,
    /// The provider is absent for this user.
    #[error("provider not found")]
    ProviderNotFound,
    /// The provider domain failed, e.g. opening the API key.
    #[error("provider: {0}")]
    Provider(ProviderError),
    /// The session's tool workspace could not be created.
    #[error("create workspace: {0}")]
    Workspace(String),
    /// The running turn failed.
    #[error(transparent)]
    Loop(LoopError),
}

impl From<ProviderError> for AgentError {
    fn from(err: ProviderError) -> Self {
        match err {
            ProviderError::NotFound => Self::ProviderNotFound,
            other => Self::Provider(other),
        }
    }
}

impl From<LoopError> for AgentError {
    fn from(err: LoopError) -> Self {
        Self::Loop(err)
    }
}
