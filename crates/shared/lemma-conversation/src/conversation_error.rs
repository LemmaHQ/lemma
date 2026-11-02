//! Error type for the conversation domain.

use sea_orm::DbErr;
use thiserror::Error;

/// Errors surfaced by the conversation domain. The RPC shell maps these
/// to wire error reasons; local callers match on them directly.
#[derive(Debug, Error)]
pub enum ConversationError {
    /// The title was empty after trimming.
    #[error("title required")]
    TitleRequired,
    /// Target conversation is absent for this user.
    #[error("conversation not found")]
    NotFound,
    /// Target conversation or message node is absent from the message tree.
    #[error("not found: {0}")]
    Missing(String),
    /// The database failed.
    #[error("db: {0}")]
    Store(String),
}

impl From<DbErr> for ConversationError {
    fn from(e: DbErr) -> Self {
        Self::Store(e.to_string())
    }
}
