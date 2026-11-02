//! Error types for the auth domain.

use sea_orm::DbErr;
use thiserror::Error;

/// Errors surfaced by the auth domain. The RPC shell maps these to wire
/// error reasons; local callers match on them directly.
#[derive(Debug, Error)]
pub enum AuthError {
    /// A required signup field was empty or the password was too short.
    #[error("signup fields required")]
    SignupFieldsRequired,
    /// Provided credentials failed authentication.
    #[error("credentials invalid")]
    CredentialsInvalid,
    /// The refresh token was missing, expired, rotated, or revoked.
    #[error("token invalid")]
    TokenInvalid,
    /// Target account is absent.
    #[error("user not found")]
    UserNotFound,
    /// The username is already registered.
    #[error("username taken")]
    UsernameTaken,
    /// The email is already registered.
    #[error("email taken")]
    EmailTaken,
    /// Access-token signing failed.
    #[error("jwt sign: {0}")]
    Sign(String),
    /// Password hashing failed.
    #[error("hash password: {0}")]
    Hash(String),
    /// The database failed.
    #[error("db: {0}")]
    Store(String),
}

impl From<DbErr> for AuthError {
    fn from(e: DbErr) -> Self {
        Self::Store(e.to_string())
    }
}
