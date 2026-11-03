//! Error type for the session domain.

use sea_orm::DbErr;
use thiserror::Error;

/// Errors surfaced by the session domain. The RPC shell maps these
/// to wire error reasons; local callers match on them directly.
#[derive(Debug, Error)]
pub enum SessionError {
    /// The title was empty after trimming.
    #[error("title required")]
    TitleRequired,
    /// Target session is absent for this user.
    #[error("session not found")]
    NotFound,
    /// Target session or message node is absent from the message tree.
    #[error("not found: {0}")]
    Missing(String),
    /// The database failed.
    #[error("db: {0}")]
    Store(String),
}

impl From<DbErr> for SessionError {
    fn from(e: DbErr) -> Self {
        Self::Store(e.to_string())
    }
}
