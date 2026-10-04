//! Error types for the auth domain.

use std::fmt;

/// Errors surfaced by auth storage backends.
#[derive(Debug)]
pub enum AuthStoreError {
    /// The username or email is already registered.
    UsernameTaken,
    /// The storage backend failed.
    Db(String),
}

impl fmt::Display for AuthStoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UsernameTaken => write!(f, "username taken"),
            Self::Db(e) => write!(f, "db: {e}"),
        }
    }
}

impl std::error::Error for AuthStoreError {}

/// Errors surfaced by the auth domain. The RPC shell maps these to wire
/// error reasons; local callers match on them directly.
#[derive(Debug)]
pub enum AuthError {
    /// A required signup field was empty or the password was too short.
    SignupFieldsRequired,
    /// Exactly one of username or email must identify the account.
    LoginTargetRequired,
    /// The login or password did not match.
    CredentialsInvalid,
    /// The refresh token was missing, expired, rotated, or revoked.
    TokenInvalid,
    /// The account does not exist.
    UserNotFound,
    /// The username or email is already registered.
    UsernameTaken,
    /// Access-token signing failed.
    Sign(String),
    /// Password hashing failed.
    Hash(String),
    /// The storage backend failed.
    Store(String),
}

impl fmt::Display for AuthError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::SignupFieldsRequired => write!(f, "signup fields required"),
            Self::LoginTargetRequired => write!(f, "login target required"),
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

impl std::error::Error for AuthError {}

impl From<AuthStoreError> for AuthError {
    fn from(e: AuthStoreError) -> Self {
        match e {
            AuthStoreError::UsernameTaken => Self::UsernameTaken,
            AuthStoreError::Db(m) => Self::Store(m),
        }
    }
}
