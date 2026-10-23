//! Runtime configuration from environment variables.

use std::env;
use std::error::Error;

use crate::secrets::Secrets;

/// All variables are required; `main()` loads `.env` first.
pub struct Config {
    /// Connection string: `postgres://…`/`postgresql://…` for the server
    /// backend, `sqlite:…` (or `sqlite://…`) for the embedded backend.
    pub database_url: String,
    /// `LEMMA_JWT_SECRET` and `LEMMA_SECRET_KEY`.
    pub secrets: Secrets,
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
    pub fn from_env() -> Result<Self, Box<dyn Error>> {
        Ok(Self {
            database_url: env::var("DATABASE_URL")?,
            secrets: Secrets {
                jwt_secret: env::var("LEMMA_JWT_SECRET")?,
                secret_key: env::var("LEMMA_SECRET_KEY")?,
            },
        })
    }

    /// Resolves the storage backend from the `DATABASE_URL` scheme.
    pub fn database_backend(&self) -> Result<DatabaseBackend, Box<dyn Error>> {
        let url = &self.database_url;
        if url.starts_with("postgres://") || url.starts_with("postgresql://") {
            Ok(DatabaseBackend::Postgres)
        } else if url.starts_with("sqlite:") {
            Ok(DatabaseBackend::Sqlite)
        } else {
            Err(format!("unsupported DATABASE_URL scheme: {url}").into())
        }
    }

    /// Filesystem path carried by a `sqlite:` URL, scheme prefix stripped.
    pub fn sqlite_path(&self) -> Result<&str, Box<dyn Error>> {
        let rest = self
            .database_url
            .strip_prefix("sqlite:")
            .ok_or("DATABASE_URL is not a sqlite: URL")?;
        Ok(rest.strip_prefix("//").unwrap_or(rest))
    }
}
