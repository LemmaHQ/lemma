//! HS256 access-token signing and verification.

use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Lifetime of an access token: 15 minutes.
pub const ACCESS_TOKEN_TTL_SECS: i64 = 15 * 60;

/// JWT claims. `sub` carries the user id.
#[derive(Serialize, Deserialize)]
#[allow(missing_docs)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

/// Signs an access token for `user_id` expiring after
/// [`ACCESS_TOKEN_TTL_SECS`].
pub fn sign_access_token(
    secret: &str,
    user_id: Uuid,
) -> Result<String, jsonwebtoken::errors::Error> {
    let exp = (chrono::Utc::now() + chrono::Duration::seconds(ACCESS_TOKEN_TTL_SECS)).timestamp()
        as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        exp,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

/// Verifies an access token's signature and expiry.
pub fn verify_access_token(
    secret: &str,
    token: &str,
) -> Result<Claims, jsonwebtoken::errors::Error> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
}
