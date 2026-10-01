//! Error type for the provider domain.

use std::fmt;

/// Errors surfaced by the provider domain. The RPC shell maps these to
/// wire error reasons; local callers match on them directly.
#[derive(Debug)]
pub enum ProviderError {
    /// A required field was empty after trimming.
    FieldsRequired,
    /// The provider kind was missing or unrecognized.
    KindInvalid,
    /// The provider does not exist for this user.
    NotFound,
    /// Sealing or opening a stored API key failed.
    Crypto(String),
    /// The storage backend failed.
    Store(String),
    /// Fetching the live model list failed.
    Fetch(String),
}

impl fmt::Display for ProviderError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::FieldsRequired => write!(f, "provider fields required"),
            Self::KindInvalid => write!(f, "provider kind invalid"),
            Self::NotFound => write!(f, "provider not found"),
            Self::Crypto(e) => write!(f, "crypto: {e}"),
            Self::Store(e) => write!(f, "store: {e}"),
            Self::Fetch(e) => write!(f, "fetch models: {e}"),
        }
    }
}

impl std::error::Error for ProviderError {}
