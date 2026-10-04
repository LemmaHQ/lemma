//! Connect RPC shell for the AuthService: cookie handling,
//! `require_user` authentication, and proto mapping. All behavior lives
//! in `lemma-auth`.

mod service;

pub use service::AuthRpc;

use lemma_auth::verify_access_token;
use lemma_proto::app_error;
use lemma_proto::lemma::v1::ErrorReason;

/// Name of the cookie carrying the access token for browser clients.
pub const ACCESS_COOKIE: &str = "lemma_access";

/// Reads a cookie from the request headers by name.
pub fn cookie_value(ctx: &connectrpc::RequestContext, name: &str) -> Option<String> {
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

/// Authenticates a request via its `Authorization: Bearer` access token,
/// falling back to the `lemma_access` cookie sent by browser clients, and
/// returns the user id. Every failure mode maps to the same `TokenInvalid`
/// error so callers cannot probe which check failed.
pub fn require_user(
    secret: &str,
    ctx: &connectrpc::RequestContext,
) -> Result<uuid::Uuid, connectrpc::ConnectError> {
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
