use std::error::Error;
use std::fmt;

use lemma_agent_loop::LoopError;
use lemma_conversation::ConversationError;
use lemma_provider::ProviderError;

/// Failure preparing or running a turn.
#[derive(Debug)]
pub enum AgentError {
    /// The message content is empty after trimming.
    ContentRequired,
    /// The model id is empty after trimming.
    ModelRequired,
    /// The provider is absent for this user.
    ProviderNotFound,
    /// The provider domain failed, e.g. opening the API key.
    Provider(ProviderError),
    /// The conversation store failed while preparing the turn.
    Store(ConversationError),
    /// The conversation's tool workspace could not be created.
    Workspace(String),
    /// The running turn failed.
    Loop(LoopError),
}

impl fmt::Display for AgentError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ContentRequired => f.write_str("content required"),
            Self::ModelRequired => f.write_str("model required"),
            Self::ProviderNotFound => f.write_str("provider not found"),
            Self::Provider(e) => write!(f, "provider: {e}"),
            Self::Store(e) => e.fmt(f),
            Self::Workspace(e) => write!(f, "create workspace: {e}"),
            Self::Loop(e) => e.fmt(f),
        }
    }
}

impl Error for AgentError {}

impl From<ProviderError> for AgentError {
    fn from(err: ProviderError) -> Self {
        match err {
            ProviderError::NotFound => Self::ProviderNotFound,
            other => Self::Provider(other),
        }
    }
}

impl From<ConversationError> for AgentError {
    fn from(err: ConversationError) -> Self {
        Self::Store(err)
    }
}

impl From<LoopError> for AgentError {
    fn from(err: LoopError) -> Self {
        Self::Loop(err)
    }
}
