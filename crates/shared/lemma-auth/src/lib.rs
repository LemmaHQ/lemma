//! Auth domain: signup, login, token refresh and rotation, generic over
//! an [`AuthStore`] backend.

mod error;
mod jwt;
mod password;
mod record;
mod service;
mod store;

pub use error::{AuthError, AuthStoreError};
pub use jwt::{ACCESS_TOKEN_TTL_SECS, Claims, sign_access_token, verify_access_token};
pub use password::{hash_password, verify_password};
pub use record::{RefreshToken, User};
pub use service::{AuthService, AuthTokens, REFRESH_TTL_DAYS, Session};
pub use store::{AuthStore, BoxAuthFuture};

use rand::Rng;
use sha2::{Digest, Sha256};

/// Generates a new refresh token: 256 random bits, hex-encoded. The
/// plaintext goes to the client; only [`hash_token`] of it is stored.
pub fn generate_refresh_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}

/// SHA-256 of a refresh token, for storage and lookup. The plaintext
/// token is never persisted.
pub fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}
