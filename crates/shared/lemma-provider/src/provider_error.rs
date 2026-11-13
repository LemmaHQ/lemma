//! Error type for the provider domain.

use thiserror::Error;

/// Errors surfaced by the provider domain. The RPC shell maps these to
/// wire error reasons; local callers match on them directly.
#[derive(Debug, Error)]
pub enum ProviderError {
    /// A required field was empty after trimming.
    #[error("provider fields required")]
    FieldsRequired,
    /// The identifier contains characters outside the standard ASCII range or is empty.
    #[error("provider identifier invalid")]
    IdentifierInvalid,
    /// The identifier is already used by another custom provider.
    #[error("provider identifier taken")]
    IdentifierTaken,
    /// The requested API format is unspecified or not served by the provider.
    #[error("api format invalid")]
    ApiFormatInvalid,
    /// Enabling a key-authenticated provider requires a saved API key.
    #[error("provider key required")]
    KeyRequired,
    /// Target provider is absent.
    #[error("provider not found")]
    NotFound,
    /// Sealing or opening a stored API key failed.
    #[error("crypto: {0}")]
    Crypto(lemma_crypto::CryptoError),
    /// The database failed.
    #[error("store: {0}")]
    Store(String),
    /// Fetching the live model list failed.
    #[error("fetch models: {0}")]
    Fetch(String),
    /// A connectivity check reached no answer from the model.
    #[error("check: {0}")]
    Check(String),
}

impl From<sqlx::Error> for ProviderError {
    fn from(e: sqlx::Error) -> Self {
        Self::Store(e.to_string())
    }
}
