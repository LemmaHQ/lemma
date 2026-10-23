//! Authentication of incoming requests by access token.

use connectrpc::{ConnectError, RequestContext};
use http::header::COOKIE;
use lemma_proto::lemma::v1::ErrorReason;
use uuid::Uuid;

/// Name of the cookie carrying the access token for browser clients.
pub const ACCESS_COOKIE: &str = "lemma_access";

/// Reads a cookie from the request headers by name.
#[must_use]
pub fn cookie_value(ctx: &RequestContext, name: &str) -> Option<String> {
    ctx.headers()
        .get_all(COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'))
        .map(str::trim)
        .find_map(|pair| {
            pair.split_once('=')
                .and_then(|(k, v)| (k == name && !v.is_empty()).then(|| v.to_owned()))
        })
}

/// Authenticates a request via its `Authorization: Bearer` access token,
/// falling back to the `lemma_access` cookie sent by browser clients, and
/// returns the user id. Every failure mode maps to the same `TokenInvalid`
/// error to preserve timing and error uniformity across checks.
///
/// # Errors
///
/// The `TokenInvalid` [`ConnectError`] for a missing, forged, or expired
/// token.
pub fn require_user(secret: &str, ctx: &RequestContext) -> Result<Uuid, ConnectError> {
    let invalid = || lemma_proto::app_error(ErrorReason::TokenInvalid);
    let bearer = ctx
        .header("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "));
    let token = bearer
        .map(str::to_owned)
        .or_else(|| cookie_value(ctx, ACCESS_COOKIE))
        .ok_or_else(invalid)?;
    let claims = lemma_auth::verify_access_token(secret, &token).map_err(|_| invalid())?;
    Uuid::parse_str(&claims.sub).map_err(|_| invalid())
}
