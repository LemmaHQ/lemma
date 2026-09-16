//! Runtime configuration from environment variables.

use std::sync::Arc;

/// All variables are required; main() loads `.env` first.
#[derive(Clone)]
pub struct Config {
    /// PostgreSQL connection string. Use 127.0.0.1, not localhost.
    pub database_url: Arc<str>,
    /// Signs and verifies access tokens.
    pub jwt_secret: Arc<str>,
    /// Master secret from which credential-sealing keys are derived.
    /// Rotating it makes all sealed values unreadable.
    pub secret_key: Arc<str>,
}

impl Config {
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL")?.into(),
            jwt_secret: std::env::var("LEMMA_JWT_SECRET")?.into(),
            secret_key: std::env::var("LEMMA_SECRET_KEY")?.into(),
        })
    }
}
