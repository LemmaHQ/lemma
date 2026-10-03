//! Handler for the AuthService RPCs.

use buffa_types::google::protobuf::Timestamp;
use chrono::{Duration, Utc};
use connectrpc::{ConnectError, RequestContext, Response, ServiceRequest, ServiceResult};
use lemma_db_pgsql::entity::User as DbUser;
use lemma_db_pgsql::{credentials, tokens, users};
use lemma_proto::app_error;
use lemma_proto::lemma::v1::{
    AuthTokens, ErrorReason, LoginResponse, LogoutResponse, MeResponse, RefreshResponse, Role,
    SignUpResponse, User,
};
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

use crate::jwt::ACCESS_TOKEN_TTL_SECS;
use crate::{
    ACCESS_COOKIE, cookie_value, generate_refresh_token, hash_password, hash_token,
    sign_access_token, verify_password,
};

/// Lifetime of a refresh token: 30 days.
const REFRESH_TTL_DAYS: i64 = 30;

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
        let value = http::HeaderValue::from_str(&cookie)
            .map_err(|e| ConnectError::internal(format!("set-cookie header: {e}")))?;
        response.headers.append(http::header::SET_COOKIE, value);
    }
    Ok(response)
}

fn refresh_token_of(ctx: &RequestContext, body: &str) -> Result<String, ConnectError> {
    if !body.is_empty() {
        return Ok(body.to_owned());
    }
    cookie_value(ctx, REFRESH_COOKIE).ok_or_else(|| app_error(ErrorReason::TokenInvalid))
}

/// Connect handler implementing the AuthService RPCs.
pub struct AuthService {
    pool: PgPool,
    secret: Arc<str>,
}

impl AuthService {
    /// Creates the handler. `secret` signs and verifies access tokens.
    pub fn new(pool: PgPool, secret: impl Into<Arc<str>>) -> Self {
        Self {
            pool,
            secret: secret.into(),
        }
    }

    // Takes an executor rather than &PgPool so refresh() can issue the new
    // token pair inside its rotation transaction.
    async fn issue_tokens<'e, E>(
        &self,
        executor: E,
        user_id: Uuid,
    ) -> Result<(AuthTokens, Uuid), ConnectError>
    where
        E: sqlx::Executor<'e, Database = sqlx::Postgres>,
    {
        let access = sign_access_token(&self.secret, user_id)
            .map_err(|e| ConnectError::internal(format!("jwt sign: {e}")))?;
        let refresh = generate_refresh_token();
        let refresh_id = Uuid::new_v4();
        tokens::insert(
            executor,
            refresh_id,
            user_id,
            &hash_token(&refresh),
            None,
            Utc::now() + Duration::days(REFRESH_TTL_DAYS),
        )
        .await
        .map_err(map_db)?;
        let exp = Utc::now() + Duration::seconds(ACCESS_TOKEN_TTL_SECS);
        let tokens = AuthTokens {
            access_token: access,
            access_token_expires_at: Timestamp::from(exp).into(),
            refresh_token: refresh,
            ..Default::default()
        };
        Ok((tokens, refresh_id))
    }
}

fn user_to_proto(u: &DbUser) -> User {
    User {
        id: u.id.to_string(),
        username: u.username.clone(),
        email: u.email.clone(),
        role: match u.role.as_str() {
            "owner" => Role::Owner,
            _ => Role::Normal,
        }
        .into(),
        created_at: Timestamp::from(u.created_at).into(),
        ..Default::default()
    }
}

fn map_db(e: sqlx::Error) -> ConnectError {
    match &e {
        sqlx::Error::Database(d) if d.is_unique_violation() => {
            app_error(ErrorReason::UsernameTaken)
        }
        _ => ConnectError::internal(format!("db: {e}")),
    }
}

fn is_owner_conflict(e: &sqlx::Error) -> bool {
    e.as_database_error()
        .and_then(|d| d.constraint())
        .is_some_and(|c| c == "users_owner_unique")
}

#[allow(refining_impl_trait)]
impl lemma_proto::lemma::v1::AuthService for AuthService {
    async fn sign_up(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, lemma_proto::lemma::v1::SignUpRequest>,
    ) -> ServiceResult<SignUpResponse> {
        let username = request.username.trim();
        let email = request.email.trim();
        let password = request.password;
        if username.is_empty() || email.is_empty() || password.len() < 8 {
            return Err(app_error(ErrorReason::SignupFieldsRequired));
        }
        let hash = hash_password(password)
            .map_err(|e| ConnectError::internal(format!("hash password: {e}")))?;
        let mut tx = self.pool.begin().await.map_err(map_db)?;
        let user = match users::insert(&mut *tx, username, email).await {
            Ok(u) => u,
            // Lost a concurrent first-signup race for the single owner
            // slot; retry, and the insert now lands as a normal user.
            Err(e) if is_owner_conflict(&e) => users::insert(&mut *tx, username, email)
                .await
                .map_err(map_db)?,
            Err(e) => return Err(map_db(e)),
        };
        credentials::upsert(&mut *tx, user.id, &hash)
            .await
            .map_err(map_db)?;
        tx.commit().await.map_err(map_db)?;
        let (tokens, _) = self.issue_tokens(&self.pool, user.id).await?;
        let cookies = session_cookies(&tokens, cookie_secure(&ctx));
        with_cookies(
            SignUpResponse {
                user: user_to_proto(&user).into(),
                tokens: tokens.into(),
                ..Default::default()
            },
            cookies,
        )
    }

    async fn login(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, lemma_proto::lemma::v1::LoginRequest>,
    ) -> ServiceResult<LoginResponse> {
        let username = request.username.trim();
        let email = request.email.trim();
        let login = match (username.is_empty(), email.is_empty()) {
            (false, true) => username,
            (true, false) => email,
            _ => {
                return Err(app_error(ErrorReason::LoginTargetRequired));
            }
        };
        let user = users::find_by_login(&self.pool, login)
            .await
            .map_err(map_db)?
            .ok_or_else(|| app_error(ErrorReason::CredentialsInvalid))?;
        let stored_hash = credentials::password_hash(&self.pool, user.id)
            .await
            .map_err(map_db)?
            .ok_or_else(|| app_error(ErrorReason::CredentialsInvalid))?;
        if !verify_password(request.password, &stored_hash) {
            return Err(app_error(ErrorReason::CredentialsInvalid));
        }
        let (tokens, _) = self.issue_tokens(&self.pool, user.id).await?;
        let cookies = session_cookies(&tokens, cookie_secure(&ctx));
        with_cookies(
            LoginResponse {
                user: user_to_proto(&user).into(),
                tokens: tokens.into(),
                ..Default::default()
            },
            cookies,
        )
    }

    async fn refresh(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, lemma_proto::lemma::v1::RefreshRequest>,
    ) -> ServiceResult<RefreshResponse> {
        let refresh_token = refresh_token_of(&ctx, request.refresh_token)?;
        let hash = hash_token(&refresh_token);
        let row = tokens::find_by_hash(&self.pool, &hash)
            .await
            .map_err(map_db)?
            .ok_or_else(|| app_error(ErrorReason::TokenInvalid))?;
        // A rotated or revoked token being presented again means theft:
        // revoke the whole rotation chain.
        if row.revoked_at.is_some() || row.replaced_by.is_some() {
            let _ = tokens::revoke_chain(&self.pool, row.id).await;
            return Err(app_error(ErrorReason::TokenInvalid));
        }
        if row.expires_at <= Utc::now() {
            return Err(app_error(ErrorReason::TokenInvalid));
        }
        let mut tx = self.pool.begin().await.map_err(map_db)?;
        let (new_tokens, new_id) = self.issue_tokens(&mut *tx, row.user_id).await?;
        tokens::mark_replaced(&mut *tx, row.id, new_id)
            .await
            .map_err(map_db)?;
        tx.commit().await.map_err(map_db)?;
        let cookies = session_cookies(&new_tokens, cookie_secure(&ctx));
        with_cookies(
            RefreshResponse {
                tokens: new_tokens.into(),
                ..Default::default()
            },
            cookies,
        )
    }

    async fn logout(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, lemma_proto::lemma::v1::LogoutRequest>,
    ) -> ServiceResult<LogoutResponse> {
        let token = if request.refresh_token.is_empty() {
            cookie_value(&ctx, REFRESH_COOKIE)
        } else {
            Some(request.refresh_token.to_owned())
        };
        if let Some(token) = token {
            let hash = hash_token(&token);
            if let Some(row) = tokens::find_by_hash(&self.pool, &hash)
                .await
                .map_err(map_db)?
            {
                tokens::revoke(&self.pool, row.id).await.map_err(map_db)?;
            }
        }
        with_cookies(
            LogoutResponse::default(),
            clear_session_cookies(cookie_secure(&ctx)),
        )
    }

    async fn me(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, lemma_proto::lemma::v1::MeRequest>,
    ) -> ServiceResult<MeResponse> {
        let user_id = crate::require_user(&self.secret, &ctx)?;
        let user = users::find_by_id(&self.pool, user_id)
            .await
            .map_err(map_db)?
            .ok_or_else(|| app_error(ErrorReason::UserNotFound))?;
        Response::ok(MeResponse {
            user: user_to_proto(&user).into(),
            ..Default::default()
        })
    }
}
