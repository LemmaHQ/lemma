//! Argon2id password hashing.

use argon2::Argon2;
use argon2::password_hash::{PasswordHasher, PasswordVerifier};

/// Hashes a password into a PHC string with embedded salt and parameters,
/// so hashes produced with older parameters keep verifying.
pub fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    Ok(Argon2::default()
        .hash_password(password.as_bytes())?
        .to_string())
}

/// Verifies a password against a PHC hash. Fails closed: a malformed hash
/// is a mismatch, not an error.
pub fn verify_password(password: &str, hash: &str) -> bool {
    Argon2::default()
        .verify_password(password.as_bytes(), hash)
        .is_ok()
}
