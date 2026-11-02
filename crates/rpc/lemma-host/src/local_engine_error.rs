use sea_orm::DbErr;
use thiserror::Error;

/// Failures of [`LocalEngine::open`](crate::LocalEngine::open), one per
/// startup step.
#[derive(Debug, Error)]
pub enum LocalEngineError {
    /// `secrets.json` could not be read, parsed, or written.
    #[error("{0}")]
    Secrets(String),
    /// `lemma.db` could not be opened or created.
    #[error("open lemma.db: {0}")]
    Database(DbErr),
    /// A migration of `lemma.db` failed.
    #[error("migrate lemma.db: {0}")]
    Migration(DbErr),
}
