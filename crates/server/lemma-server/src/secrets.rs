use serde::{Deserialize, Serialize};

/// The engine's signing and sealing secrets.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Secrets {
    /// Signs and verifies access tokens.
    pub jwt_secret: String,
    /// Master secret from which credential-sealing keys are derived.
    /// Rotating it makes all sealed values unreadable.
    pub secret_key: String,
}
