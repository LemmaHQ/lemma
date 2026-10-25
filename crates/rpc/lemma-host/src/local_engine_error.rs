use std::error::Error;
use std::fmt;

use sea_orm::DbErr;

/// Failures of [`LocalEngine::open`](crate::LocalEngine::open), one per
/// startup step.
#[derive(Debug)]
pub enum LocalEngineError {
    /// `secrets.json` could not be read, parsed, or written.
    Secrets(String),
    /// `lemma.db` could not be opened or created.
    Database(DbErr),
    /// A migration of `lemma.db` failed.
    Migration(DbErr),
}

impl fmt::Display for LocalEngineError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Secrets(e) => write!(f, "{e}"),
            Self::Database(e) => write!(f, "open lemma.db: {e}"),
            Self::Migration(e) => write!(f, "migrate lemma.db: {e}"),
        }
    }
}

impl Error for LocalEngineError {}
