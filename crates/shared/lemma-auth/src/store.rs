//! Storage contract for the auth domain.

use std::pin::Pin;

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::error::AuthStoreError;
use crate::record::{RefreshToken, User};

/// Future returned by asynchronous auth store operations.
pub type BoxAuthFuture<'a, T> =
    Pin<Box<dyn Future<Output = Result<T, AuthStoreError>> + Send + 'a>>;

/// Storage backend for accounts and refresh tokens. Implemented by both
/// db crates (`PgAuthStore`, `SqliteAuthStore`) so the domain runs
/// identically on server and local modes.
pub trait AuthStore: Send + Sync {
    /// Creates a user and stores its password hash in one transaction.
    /// The first user becomes the owner; a lost owner race is retried
    /// inside the implementation. Returns [`AuthStoreError::UsernameTaken`]
    /// on a duplicate username or email.
    fn create_user_with_credential<'a>(
        &'a self,
        username: &'a str,
        email: &'a str,
        password_hash: &'a str,
    ) -> BoxAuthFuture<'a, User>;

    /// Finds a user by username or email; `login` matches either column.
    fn find_user_by_login<'a>(&'a self, login: &'a str) -> BoxAuthFuture<'a, Option<User>>;

    /// Finds a user by id.
    fn find_user_by_id<'a>(&'a self, id: Uuid) -> BoxAuthFuture<'a, Option<User>>;

    /// Returns the account's password hash, when credentials exist.
    fn password_hash<'a>(&'a self, user_id: Uuid) -> BoxAuthFuture<'a, Option<String>>;

    /// Inserts a refresh token row and returns it.
    fn insert_refresh_token<'a>(
        &'a self,
        id: Uuid,
        user_id: Uuid,
        token_hash: &'a str,
        label: Option<&'a str>,
        expires_at: DateTime<Utc>,
    ) -> BoxAuthFuture<'a, RefreshToken>;

    /// Looks up a token row by its SHA-256 hash.
    fn find_refresh_token_by_hash<'a>(
        &'a self,
        token_hash: &'a str,
    ) -> BoxAuthFuture<'a, Option<RefreshToken>>;

    /// Atomically inserts the rotation successor and marks the consumed
    /// token replaced by it.
    fn rotate_refresh_token<'a>(
        &'a self,
        id: Uuid,
        new_id: Uuid,
        new_token_hash: &'a str,
        new_expires_at: DateTime<Utc>,
    ) -> BoxAuthFuture<'a, RefreshToken>;

    /// Revokes a single token. Idempotent.
    fn revoke_refresh_token<'a>(&'a self, id: Uuid) -> BoxAuthFuture<'a, u64>;

    /// Revokes a token and every successor in its rotation chain,
    /// following `replaced_by` recursively.
    fn revoke_refresh_chain<'a>(&'a self, id: Uuid) -> BoxAuthFuture<'a, u64>;
}
