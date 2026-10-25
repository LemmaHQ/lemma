//! Error types for the auth domain.

use std::error::Error;
use std::fmt;

use sea_orm::DbErr;

/// Errors surfaced by the auth domain. The RPC shell maps these to wire
/// error reasons; local callers match on them directly.
#[derive(Debug)]
pub enum AuthError {
    /// A required signup field was empty or the password was too short.
    SignupFieldsRequired,
    /// Provided credentials failed authentication.
    CredentialsInvalid,
    /// The refresh token was missing, expired, rotated, or revoked.
    TokenInvalid,
    /// Target account is absent.
    UserNotFound,
    /// The username or email is already registered.
    UsernameTaken,
    /// Access-token signing failed.
    Sign(String),
    /// Password hashing failed.
    Hash(String),
    /// The database failed.
    Store(String),
}

impl fmt::Display for AuthError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::SignupFieldsRequired => write!(f, "signup fields required"),
            Self::CredentialsInvalid => write!(f, "credentials invalid"),
            Self::TokenInvalid => write!(f, "token invalid"),
            Self::UserNotFound => write!(f, "user not found"),
            Self::UsernameTaken => write!(f, "username taken"),
            Self::Sign(e) => write!(f, "jwt sign: {e}"),
            Self::Hash(e) => write!(f, "hash password: {e}"),
            Self::Store(e) => write!(f, "db: {e}"),
        }
    }
}

impl Error for AuthError {}

impl From<DbErr> for AuthError {
    fn from(e: DbErr) -> Self {
        Self::Store(e.to_string())
    }
}
