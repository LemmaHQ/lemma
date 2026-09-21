use std::fmt;

/// Errors produced during session tree operations and persistence.
#[derive(Debug)]
pub enum SessionError {
    /// Failure persisting or querying the underlying trace store.
    Store(String),
    /// The conversation or targeted message node does not exist.
    NotFound(String),
}

impl fmt::Display for SessionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Store(e) => write!(f, "store error: {e}"),
            Self::NotFound(e) => write!(f, "not found: {e}"),
        }
    }
}

impl std::error::Error for SessionError {}
