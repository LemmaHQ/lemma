//! Error type for the session domain.

use thiserror::Error;

/// Errors surfaced by the session domain. The RPC shell maps these
/// to wire error reasons; local callers match on them directly.
#[derive(Debug, Error)]
pub enum SessionError {
    /// The title was empty after trimming.
    #[error("title required")]
    TitleRequired,
    /// Target session is absent.
    #[error("session not found")]
    NotFound,
    /// Target message is absent.
    #[error("message not found")]
    MessageNotFound,
    /// Target message cannot serve as a branch or leaf boundary.
    #[error("invalid branch point")]
    InvalidBranchPoint,
    /// The directory is not an absolute path to an existing directory.
    #[error("directory not found: {0}")]
    DirectoryNotFound(String),
    /// Target session or message node is absent from the message tree.
    #[error("not found: {0}")]
    Missing(String),
    /// The database failed.
    #[error("db: {0}")]
    Store(String),
}

impl From<sqlx::Error> for SessionError {
    fn from(e: sqlx::Error) -> Self {
        Self::Store(e.to_string())
    }
}
