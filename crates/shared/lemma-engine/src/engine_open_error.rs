use serde_json::Error as JsonError;
use sqlx::Error as SqlxError;
use sqlx::migrate::MigrateError;
use thiserror::Error;

/// Failures of [`Engine::open`](crate::Engine::open), by startup step.
#[derive(Debug, Error)]
pub enum EngineOpenError {
    /// The data directory could not be created or `secrets.json` written.
    #[error("{0}")]
    Secrets(String),
    /// `secrets.json` could not be parsed or serialized.
    #[error("secrets.json: {0}")]
    SecretsJson(JsonError),
    /// `lemma.db` could not be opened or created.
    #[error("open lemma.db: {0}")]
    Database(SqlxError),
    /// A migration of `lemma.db` failed.
    #[error("migrate lemma.db: {0}")]
    Migration(MigrateError),
}
