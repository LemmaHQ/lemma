//! Error type for the conversation domain.

use std::fmt;

/// Errors surfaced by the conversation domain. The RPC shell maps these
/// to wire error reasons; local callers match on them directly.
#[derive(Debug)]
pub enum ConversationError {
    /// The title was empty after trimming.
    TitleRequired,
    /// Target conversation is absent for this user.
    NotFound,
    /// Target conversation or message node is absent from the message tree.
    Missing(String),
    /// The storage backend failed.
    Store(String),
}

impl fmt::Display for ConversationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::TitleRequired => write!(f, "title required"),
            Self::NotFound => write!(f, "conversation not found"),
            Self::Missing(e) => write!(f, "not found: {e}"),
            Self::Store(e) => write!(f, "db: {e}"),
        }
    }
}

impl std::error::Error for ConversationError {}
