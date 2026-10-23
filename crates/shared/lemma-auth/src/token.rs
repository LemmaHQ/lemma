//! Refresh-token generation and hashing.

use sha2::Sha256;

/// Generates a new refresh token: 256 random bits, hex-encoded. The
/// plaintext goes to the client; only [`hash_token`] of it is stored.
#[must_use]
pub fn generate_refresh_token() -> String {
    use rand::Rng;

    let mut bytes = [0u8; 32];
    rand::rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}

/// SHA-256 of a refresh token, for storage and lookup. The plaintext
/// token stays strictly ephemeral in memory.
#[must_use]
pub fn hash_token(token: &str) -> String {
    use sha2::Digest;

    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}
