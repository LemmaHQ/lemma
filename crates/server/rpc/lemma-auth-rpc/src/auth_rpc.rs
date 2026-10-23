//! Handler for the `AuthService` RPCs.

use std::fmt::{self, Debug};

use buffa_types::google::protobuf::Timestamp;
use connectrpc::{ConnectError, RequestContext, Response, ServiceRequest, ServiceResult};
use http::HeaderValue;
use http::header::SET_COOKIE;
use lemma_auth::{
    ACCESS_TOKEN_TTL_SECS, AuthError, AuthService, AuthStore, AuthTokens, REFRESH_TTL_DAYS, User,
};
use lemma_proto::lemma::v1;
use lemma_proto::lemma::v1::{
    ErrorReason, LoginRequest, LoginResponse, LogoutRequest, LogoutResponse, MeRequest, MeResponse,
    RefreshRequest, RefreshResponse, SignUpRequest, SignUpResponse,
};

use crate::request_auth::{self, ACCESS_COOKIE};

const REFRESH_COOKIE: &str = "lemma_refresh";
const REFRESH_COOKIE_PATH: &str = "/lemma.v1.AuthService";

fn cookie_secure(ctx: &RequestContext) -> bool {
    ctx.header("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        == Some("https")
}

fn set_cookie(value: &str, path: &str, max_age_secs: i64, secure: bool) -> String {
    let secure_attr = if secure { "; Secure" } else { "" };
    format!("{value}; HttpOnly; SameSite=Lax; Path={path}; Max-Age={max_age_secs}{secure_attr}")
}

fn session_cookies(tokens: &AuthTokens, secure: bool) -> [String; 2] {
    [
        set_cookie(
            &format!("{ACCESS_COOKIE}={}", tokens.access_token),
            "/",
            ACCESS_TOKEN_TTL_SECS,
            secure,
        ),
        set_cookie(
            &format!("{REFRESH_COOKIE}={}", tokens.refresh_token),
            REFRESH_COOKIE_PATH,
            REFRESH_TTL_DAYS * 24 * 60 * 60,
            secure,
        ),
    ]
}

fn clear_session_cookies(secure: bool) -> [String; 2] {
    [
        set_cookie(&format!("{ACCESS_COOKIE}="), "/", 0, secure),
        set_cookie(
            &format!("{REFRESH_COOKIE}="),
            REFRESH_COOKIE_PATH,
            0,
            secure,
        ),
    ]
}

fn with_cookies<B>(body: B, cookies: [String; 2]) -> ServiceResult<B> {
    let mut response = Response::new(body);
    for cookie in cookies {
        let value = HeaderValue::from_str(&cookie)
            .map_err(|e| ConnectError::internal(format!("set-cookie header: {e}")))?;
        response.headers.append(SET_COOKIE, value);
    }
    Ok(response)
}

fn refresh_token_of(ctx: &RequestContext, body: &str) -> Result<String, ConnectError> {
    if !body.is_empty() {
        return Ok(body.to_owned());
    }
    request_auth::cookie_value(ctx, REFRESH_COOKIE)
        .ok_or_else(|| lemma_proto::app_error(ErrorReason::TokenInvalid))
}

/// Connect handler implementing the `AuthService` RPCs.
pub struct AuthRpc<A> {
    domain: AuthService<A>,
    secret: String,
}

impl<A: Debug> Debug for AuthRpc<A> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("AuthRpc")
            .field("domain", &self.domain)
            .finish_non_exhaustive()
    }
}

impl<A: AuthStore> AuthRpc<A> {
    /// Creates the handler over an auth store backend. `secret` signs and
    /// verifies access tokens.
    pub fn new(store: A, secret: String) -> Self {
        Self {
            domain: AuthService::new(store, secret.clone()),
            secret,
        }
    }
}

fn user_to_proto(u: &User) -> v1::User {
    v1::User {
        id: u.id.to_string(),
        username: u.username.clone(),
        email: u.email.clone(),
        created_at: Timestamp::from(u.created_at).into(),
        ..Default::default()
    }
}

fn tokens_to_proto(t: AuthTokens) -> v1::AuthTokens {
    v1::AuthTokens {
        access_token: t.access_token,
        access_token_expires_at: Timestamp::from(t.access_token_expires_at).into(),
        refresh_token: t.refresh_token,
        ..Default::default()
    }
}

fn map_domain(e: AuthError) -> ConnectError {
    match e {
        AuthError::SignupFieldsRequired => {
            lemma_proto::app_error(ErrorReason::SignupFieldsRequired)
        }
        AuthError::CredentialsInvalid => lemma_proto::app_error(ErrorReason::CredentialsInvalid),
        AuthError::TokenInvalid => lemma_proto::app_error(ErrorReason::TokenInvalid),
        AuthError::UserNotFound => lemma_proto::app_error(ErrorReason::UserNotFound),
        AuthError::UsernameTaken => lemma_proto::app_error(ErrorReason::UsernameTaken),
        AuthError::Sign(m) => ConnectError::internal(format!("jwt sign: {m}")),
        AuthError::Hash(m) => ConnectError::internal(format!("hash password: {m}")),
        AuthError::Store(m) => ConnectError::internal(format!("db: {m}")),
    }
}

#[allow(refining_impl_trait)]
impl<A: AuthStore> v1::AuthService for AuthRpc<A> {
    async fn sign_up(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, SignUpRequest>,
    ) -> ServiceResult<SignUpResponse> {
        let session = self
            .domain
            .sign_up(request.username, request.email, request.password)
            .await
            .map_err(map_domain)?;
        let cookies = session_cookies(&session.tokens, cookie_secure(&ctx));
        with_cookies(
            SignUpResponse {
                user: user_to_proto(&session.user).into(),
                tokens: tokens_to_proto(session.tokens).into(),
                ..Default::default()
            },
            cookies,
        )
    }

    async fn login(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, LoginRequest>,
    ) -> ServiceResult<LoginResponse> {
        let session = self
            .domain
            .login(request.login, request.password)
            .await
            .map_err(map_domain)?;
        let cookies = session_cookies(&session.tokens, cookie_secure(&ctx));
        with_cookies(
            LoginResponse {
                user: user_to_proto(&session.user).into(),
                tokens: tokens_to_proto(session.tokens).into(),
                ..Default::default()
            },
            cookies,
        )
    }

    async fn refresh(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, RefreshRequest>,
    ) -> ServiceResult<RefreshResponse> {
        let refresh_token = refresh_token_of(&ctx, request.refresh_token)?;
        let tokens = self
            .domain
            .refresh(&refresh_token)
            .await
            .map_err(map_domain)?;
        let cookies = session_cookies(&tokens, cookie_secure(&ctx));
        with_cookies(
            RefreshResponse {
                tokens: tokens_to_proto(tokens).into(),
                ..Default::default()
            },
            cookies,
        )
    }

    async fn logout(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, LogoutRequest>,
    ) -> ServiceResult<LogoutResponse> {
        let token = if request.refresh_token.is_empty() {
            request_auth::cookie_value(&ctx, REFRESH_COOKIE)
        } else {
            Some(request.refresh_token.to_owned())
        };
        self.domain
            .logout(token.as_deref())
            .await
            .map_err(map_domain)?;
        with_cookies(
            LogoutResponse::default(),
            clear_session_cookies(cookie_secure(&ctx)),
        )
    }

    async fn me(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, MeRequest>,
    ) -> ServiceResult<MeResponse> {
        let user_id = request_auth::require_user(&self.secret, &ctx)?;
        let user = self.domain.me(user_id).await.map_err(map_domain)?;
        Response::ok(MeResponse {
            user: user_to_proto(&user).into(),
            ..Default::default()
        })
    }
}
