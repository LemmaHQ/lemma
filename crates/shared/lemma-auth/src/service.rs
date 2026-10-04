//! Auth business flows: signup, login, token refresh and rotation over
//! an [`AuthStore`] backend.

use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use uuid::Uuid;

use crate::error::AuthError;
use crate::jwt::{ACCESS_TOKEN_TTL_SECS, sign_access_token};
use crate::password::{hash_password, verify_password};
use crate::record::User;
use crate::store::AuthStore;
use crate::{generate_refresh_token, hash_token};

/// Lifetime of a refresh token: 30 days.
pub const REFRESH_TTL_DAYS: i64 = 30;

/// A freshly issued access + refresh token pair.
#[derive(Debug, Clone)]
pub struct AuthTokens {
    /// Signed access token.
    pub access_token: String,
    /// Access-token expiry time.
    pub access_token_expires_at: DateTime<Utc>,
    /// Plaintext refresh token; only its hash is stored.
    pub refresh_token: String,
}

/// An authenticated session: the account plus its issued tokens.
#[derive(Debug, Clone)]
pub struct Session {
    /// The authenticated account.
    pub user: User,
    /// Issued tokens.
    pub tokens: AuthTokens,
}

/// Auth domain service over an [`AuthStore`] backend.
pub struct AuthService {
    store: Arc<dyn AuthStore>,
    secret: Arc<str>,
}

impl AuthService {
    /// Creates the service. `secret` signs and verifies access tokens.
    pub fn new(store: Arc<dyn AuthStore>, secret: impl Into<Arc<str>>) -> Self {
        Self {
            store,
            secret: secret.into(),
        }
    }

    async fn issue_tokens(&self, user_id: Uuid) -> Result<AuthTokens, AuthError> {
        let access =
            sign_access_token(&self.secret, user_id).map_err(|e| AuthError::Sign(e.to_string()))?;
        let refresh = generate_refresh_token();
        self.store
            .insert_refresh_token(
                Uuid::new_v4(),
                user_id,
                &hash_token(&refresh),
                None,
                Utc::now() + Duration::days(REFRESH_TTL_DAYS),
            )
            .await?;
        Ok(AuthTokens {
            access_token: access,
            access_token_expires_at: Utc::now() + Duration::seconds(ACCESS_TOKEN_TTL_SECS),
            refresh_token: refresh,
        })
    }

    /// Registers a new account and opens a session.
    pub async fn sign_up(
        &self,
        username: &str,
        email: &str,
        password: &str,
    ) -> Result<Session, AuthError> {
        let username = username.trim();
        let email = email.trim();
        if username.is_empty() || email.is_empty() || password.len() < 8 {
            return Err(AuthError::SignupFieldsRequired);
        }
        let hash = hash_password(password).map_err(|e| AuthError::Hash(e.to_string()))?;
        let user = self
            .store
            .create_user_with_credential(username, email, &hash)
            .await?;
        let tokens = self.issue_tokens(user.id).await?;
        Ok(Session { user, tokens })
    }

    /// Authenticates by username or email and opens a session.
    pub async fn login(
        &self,
        username: &str,
        email: &str,
        password: &str,
    ) -> Result<Session, AuthError> {
        let username = username.trim();
        let email = email.trim();
        let login = match (username.is_empty(), email.is_empty()) {
            (false, true) => username,
            (true, false) => email,
            _ => return Err(AuthError::LoginTargetRequired),
        };
        let user = self
            .store
            .find_user_by_login(login)
            .await?
            .ok_or(AuthError::CredentialsInvalid)?;
        let stored_hash = self
            .store
            .password_hash(user.id)
            .await?
            .ok_or(AuthError::CredentialsInvalid)?;
        if !verify_password(password, &stored_hash) {
            return Err(AuthError::CredentialsInvalid);
        }
        let tokens = self.issue_tokens(user.id).await?;
        Ok(Session { user, tokens })
    }

    /// Rotates a refresh token and returns a fresh token pair. A rotated
    /// or revoked token presented again means theft: the whole rotation
    /// chain is revoked.
    pub async fn refresh(&self, refresh_token: &str) -> Result<AuthTokens, AuthError> {
        let row = self
            .store
            .find_refresh_token_by_hash(&hash_token(refresh_token))
            .await?
            .ok_or(AuthError::TokenInvalid)?;
        if row.revoked_at.is_some() || row.replaced_by.is_some() {
            let _ = self.store.revoke_refresh_chain(row.id).await;
            return Err(AuthError::TokenInvalid);
        }
        if row.expires_at <= Utc::now() {
            return Err(AuthError::TokenInvalid);
        }
        let access = sign_access_token(&self.secret, row.user_id)
            .map_err(|e| AuthError::Sign(e.to_string()))?;
        let refresh = generate_refresh_token();
        self.store
            .rotate_refresh_token(
                row.id,
                Uuid::new_v4(),
                &hash_token(&refresh),
                Utc::now() + Duration::days(REFRESH_TTL_DAYS),
            )
            .await?;
        Ok(AuthTokens {
            access_token: access,
            access_token_expires_at: Utc::now() + Duration::seconds(ACCESS_TOKEN_TTL_SECS),
            refresh_token: refresh,
        })
    }

    /// Revokes the presented refresh token, when it exists.
    pub async fn logout(&self, refresh_token: Option<&str>) -> Result<(), AuthError> {
        if let Some(token) = refresh_token
            && let Some(row) = self
                .store
                .find_refresh_token_by_hash(&hash_token(token))
                .await?
        {
            self.store.revoke_refresh_token(row.id).await?;
        }
        Ok(())
    }

    /// Returns the account for an authenticated user id.
    pub async fn me(&self, user_id: Uuid) -> Result<User, AuthError> {
        self.store
            .find_user_by_id(user_id)
            .await?
            .ok_or(AuthError::UserNotFound)
    }
}
