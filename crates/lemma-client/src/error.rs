use std::fmt;

/// Errors emitted across the client engine surface.
#[derive(Debug)]
pub enum ClientError {
    /// Failure during local storage or session tree access.
    Session(String),
    /// Failure from the agent execution loop or upstream provider.
    Agent(String),
    /// Network or remote ConnectRPC communication failure.
    Remote(String),
    /// Resource not found (conversation, message node).
    NotFound(String),
    /// General invalid argument or input format.
    InvalidInput(String),
}

impl fmt::Display for ClientError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Session(e) => write!(f, "session error: {e}"),
            Self::Agent(e) => write!(f, "agent error: {e}"),
            Self::Remote(e) => write!(f, "remote error: {e}"),
            Self::NotFound(e) => write!(f, "not found: {e}"),
            Self::InvalidInput(e) => write!(f, "invalid input: {e}"),
        }
    }
}

impl std::error::Error for ClientError {}

impl From<lemma_session::SessionError> for ClientError {
    fn from(err: lemma_session::SessionError) -> Self {
        match err {
            lemma_session::SessionError::Store(e) => Self::Session(e),
            lemma_session::SessionError::NotFound(e) => Self::NotFound(e),
        }
    }
}

impl From<lemma_agent::AgentError> for ClientError {
    fn from(err: lemma_agent::AgentError) -> Self {
        Self::Agent(err.to_string())
    }
}

impl From<lemma_db_client::SqliteStoreError> for ClientError {
    fn from(err: lemma_db_client::SqliteStoreError) -> Self {
        Self::Session(err.to_string())
    }
}
