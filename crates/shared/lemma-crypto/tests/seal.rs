//! Sealing and opening secrets with keys derived from master secrets.

use std::error::Error;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use lemma_crypto::{CryptoError, derive_key, open, seal};

#[test]
fn a_sealed_secret_opens_under_the_same_master_secret() -> Result<(), Box<dyn Error>> {
    let key = derive_key("master");

    let first = seal(&key, "sk-ключ")?;
    let second = seal(&key, "sk-ключ")?;

    assert_ne!(first, second, "each seal uses a fresh nonce");
    assert_eq!(open(&derive_key("master"), &first)?, "sk-ключ", "first");
    assert_eq!(open(&key, &second)?, "sk-ключ", "second");
    Ok(())
}

#[test]
fn another_master_secret_or_a_tampered_payload_fails_to_decrypt() -> Result<(), Box<dyn Error>> {
    let sealed = seal(&derive_key("master"), "sk-1")?;
    let mut raw = STANDARD.decode(&sealed)?;
    let Some(last) = raw.last_mut() else {
        return Err("empty sealed payload".into());
    };
    *last ^= 1;
    let tampered = STANDARD.encode(raw);

    assert_eq!(
        open(&derive_key("rotated"), &sealed),
        Err(CryptoError::Decrypt),
        "rotated master secret"
    );
    assert_eq!(
        open(&derive_key("master"), &tampered),
        Err(CryptoError::Decrypt),
        "tampered payload"
    );
    Ok(())
}

#[test]
fn a_payload_that_is_not_a_sealed_value_is_an_encoding_error() {
    let key = derive_key("master");

    assert_eq!(
        open(&key, "not base64!"),
        Err(CryptoError::Encoding),
        "not base64"
    );
    assert_eq!(
        open(&key, &STANDARD.encode([0u8; 11])),
        Err(CryptoError::Encoding),
        "shorter than a nonce"
    );
}
