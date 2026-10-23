//! Credential sealing for secrets at rest, such as provider API keys and
//! S3 credentials.
//!
//! Secrets are encrypted with AES-256-GCM under a key derived from the
//! configured master secret and stored base64-encoded in the database.

use std::error::Error;
use std::fmt;

use aes_gcm::Aes256Gcm;
use aes_gcm::aead::{Aead, Key, KeyInit, Nonce};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use sha2::Sha256;

/// Failure modes of [`seal`] and [`open`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CryptoError {
    /// AEAD operation failed. In practice this means decryption with the
    /// wrong key or a tampered payload.
    Decrypt,
    /// Input payload is malformed: invalid base64 encoding, truncated length,
    /// or corrupted plaintext following decryption.
    Encoding,
}

impl fmt::Display for CryptoError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Decrypt => write!(f, "decrypt failed"),
            Self::Encoding => write!(f, "invalid sealed key encoding"),
        }
    }
}

impl Error for CryptoError {}

/// Derives the AES-256 key from the master secret via SHA-256.
///
/// The derivation is deterministic and unsalted, so rotating the master
/// secret makes every previously sealed value unreadable.
#[must_use]
pub fn derive_key(secret: &str) -> Key<Aes256Gcm> {
    use sha2::Digest;

    let digest = Sha256::digest(secret.as_bytes());
    let mut key = [0u8; 32];
    key.copy_from_slice(&digest);
    Key::<Aes256Gcm>::from(key)
}

/// Encrypts `plaintext` and returns the sealed payload as
/// base64(nonce ‖ ciphertext) with a fresh random 12-byte nonce per call.
///
/// # Errors
///
/// [`CryptoError::Decrypt`] when the AEAD encryption fails.
pub fn seal(key: &Key<Aes256Gcm>, plaintext: &str) -> Result<String, CryptoError> {
    use aes_gcm::aead::Generate;

    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::<Aes256Gcm>::generate();
    let ct = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|_| CryptoError::Decrypt)?;
    let mut out = Vec::with_capacity(12 + ct.len());
    out.extend_from_slice(nonce.as_slice());
    out.extend_from_slice(&ct);
    Ok(STANDARD.encode(out))
}

/// Reverses [`seal`].
///
/// # Errors
///
/// [`CryptoError::Encoding`] for malformed input; [`CryptoError::Decrypt`]
/// for a wrong key or tampered data.
pub fn open(key: &Key<Aes256Gcm>, sealed: &str) -> Result<String, CryptoError> {
    let raw = STANDARD.decode(sealed).map_err(|_| CryptoError::Encoding)?;
    let (nonce, ct) = raw.split_at_checked(12).ok_or(CryptoError::Encoding)?;
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::<Aes256Gcm>::try_from(nonce).map_err(|_| CryptoError::Encoding)?;
    let pt = cipher
        .decrypt(&nonce, ct)
        .map_err(|_| CryptoError::Decrypt)?;
    String::from_utf8(pt).map_err(|_| CryptoError::Encoding)
}
