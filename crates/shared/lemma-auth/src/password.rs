//! Argon2id password hashing.

use argon2::Argon2;
use argon2::password_hash::Error;

/// Hashes a password into a PHC string with embedded salt and parameters,
/// so hashes produced with older parameters keep verifying.
///
/// # Errors
///
/// The `argon2` [`Error`] when hashing fails.
pub fn hash_password(password: &str) -> Result<String, Error> {
    use argon2::password_hash::PasswordHasher;

    Ok(Argon2::default()
        .hash_password(password.as_bytes())?
        .to_string())
}

/// Verifies a password against a PHC hash. Fails closed: treating a malformed hash
/// as a verification mismatch.
#[must_use]
pub fn verify_password(password: &str, hash: &str) -> bool {
    use argon2::password_hash::PasswordVerifier;

    Argon2::default()
        .verify_password(password.as_bytes(), hash)
        .is_ok()
}
