//! Runtime configuration from environment variables.

use std::sync::Arc;

/// All variables are required; main() loads `.env` first.
#[derive(Clone)]
pub struct Config {
    /// Connection string: `postgres://…`/`postgresql://…` for the server
    /// backend, `sqlite:…` (or `sqlite://…`) for the embedded backend.
    pub database_url: Arc<str>,
    /// Signs and verifies access tokens.
    pub jwt_secret: Arc<str>,
    /// Master secret from which credential-sealing keys are derived.
    /// Rotating it makes all sealed values unreadable.
    pub secret_key: Arc<str>,
}

/// Storage backend selected by the `DATABASE_URL` scheme.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DatabaseBackend {
    /// PostgreSQL server backend.
    Postgres,
    /// Embedded SQLite backend.
    Sqlite,
}

impl Config {
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL")?.into(),
            jwt_secret: std::env::var("LEMMA_JWT_SECRET")?.into(),
            secret_key: std::env::var("LEMMA_SECRET_KEY")?.into(),
        })
    }

    /// Resolves the storage backend from the `DATABASE_URL` scheme.
    pub fn database_backend(&self) -> Result<DatabaseBackend, Box<dyn std::error::Error>> {
        let url = &*self.database_url;
        if url.starts_with("postgres://") || url.starts_with("postgresql://") {
            Ok(DatabaseBackend::Postgres)
        } else if url.starts_with("sqlite:") {
            Ok(DatabaseBackend::Sqlite)
        } else {
            Err(format!("unsupported DATABASE_URL scheme: {url}").into())
        }
    }

    /// Filesystem path carried by a `sqlite:` URL, scheme prefix stripped.
    pub fn sqlite_path(&self) -> Result<String, Box<dyn std::error::Error>> {
        let rest = self
            .database_url
            .strip_prefix("sqlite:")
            .ok_or("DATABASE_URL is not a sqlite: URL")?;
        Ok(rest.strip_prefix("//").unwrap_or(rest).to_owned())
    }
}
