use serde::{Deserialize, Serialize};

/// The engine's sealing secret.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct Secrets {
    /// Master secret from which credential-sealing keys are derived.
    /// Rotating it makes all sealed values unreadable.
    pub(crate) secret_key: String,
}
