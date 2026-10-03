//! Auth domain: signup, login, token refresh and rotation.

mod jwt;
mod password;
mod service;

pub use jwt::{Claims, sign_access_token, verify_access_token};
pub use password::{hash_password, verify_password};
pub use service::AuthService;

use rand::Rng;
use sha2::{Digest, Sha256};

pub(crate) const ACCESS_COOKIE: &str = "lemma_access";

pub(crate) fn cookie_value(ctx: &connectrpc::RequestContext, name: &str) -> Option<String> {
    ctx.headers()
        .get_all(http::header::COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'))
        .map(str::trim)
        .find_map(|pair| {
            pair.split_once('=')
                .and_then(|(k, v)| (k == name && !v.is_empty()).then(|| v.to_owned()))
        })
}

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

/// Authenticates a request via its `Authorization: Bearer` access token,
/// falling back to the `lemma_access` cookie sent by browser clients, and
/// returns the user id. Every failure mode maps to the same `TokenInvalid`
/// error so callers cannot probe which check failed.
pub fn require_user(
    secret: &str,
    ctx: &connectrpc::RequestContext,
) -> Result<uuid::Uuid, connectrpc::ConnectError> {
    use lemma_proto::app_error;
    use lemma_proto::lemma::v1::ErrorReason;

    let bearer = ctx
        .header("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "));
    let token = bearer
        .map(str::to_owned)
        .or_else(|| cookie_value(ctx, ACCESS_COOKIE))
        .ok_or_else(|| app_error(ErrorReason::TokenInvalid))?;
    let claims =
        verify_access_token(secret, &token).map_err(|_| app_error(ErrorReason::TokenInvalid))?;
    uuid::Uuid::parse_str(&claims.sub).map_err(|_| app_error(ErrorReason::TokenInvalid))
}
