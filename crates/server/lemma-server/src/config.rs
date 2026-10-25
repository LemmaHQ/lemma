//! Runtime configuration from environment variables.

use std::env;
use std::error::Error;

use lemma_host::Secrets;

/// All variables are required; `main()` loads `.env` first.
pub struct Config {
    /// Connection string: `postgres://…`/`postgresql://…` for PostgreSQL,
    /// `sqlite:…` (or `sqlite://…`) for an embedded SQLite file.
    pub database_url: String,
    /// `LEMMA_JWT_SECRET` and `LEMMA_SECRET_KEY`.
    pub secrets: Secrets,
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
}
