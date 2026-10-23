//! Storage contract for the auth domain.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::auth_error::AuthStoreError;
use crate::record::{RefreshToken, User};

/// Storage backend for accounts and refresh tokens. Implemented by both
/// db crates (`PgAuthStore`, `SqliteAuthStore`) so the domain runs
/// identically on server and local modes. Clones share one connection
/// pool.
///
/// Every operation fails with [`AuthStoreError::Db`] when the backend
/// fails.
pub trait AuthStore: Clone + Send + Sync + 'static {
    /// Creates a user and stores its password hash in one transaction.
    /// Fails with [`AuthStoreError::UsernameTaken`] on a duplicate username
    /// or email.
    fn create_user_with_credential(
        &self,
        username: &str,
        email: &str,
        password_hash: &str,
    ) -> impl Future<Output = Result<User, AuthStoreError>> + Send;

    /// Finds a user by username or email; `login` matches either column.
    fn find_user_by_login(
        &self,
        login: &str,
    ) -> impl Future<Output = Result<Option<User>, AuthStoreError>> + Send;

    /// Finds a user by id.
    fn find_user_by_id(
        &self,
        id: Uuid,
    ) -> impl Future<Output = Result<Option<User>, AuthStoreError>> + Send;

    /// Returns the account's password hash, when credentials exist.
    fn password_hash(
        &self,
        user_id: Uuid,
    ) -> impl Future<Output = Result<Option<String>, AuthStoreError>> + Send;

    /// Inserts a refresh token row.
    fn insert_refresh_token(
        &self,
        id: Uuid,
        user_id: Uuid,
        token_hash: &str,
        expires_at: DateTime<Utc>,
    ) -> impl Future<Output = Result<(), AuthStoreError>> + Send;

    /// Looks up a token row by its SHA-256 hash.
    fn find_refresh_token_by_hash(
        &self,
        token_hash: &str,
    ) -> impl Future<Output = Result<Option<RefreshToken>, AuthStoreError>> + Send;

    /// Atomically inserts the rotation successor and marks the consumed
    /// token replaced by it.
    fn rotate_refresh_token(
        &self,
        id: Uuid,
        new_id: Uuid,
        new_token_hash: &str,
        new_expires_at: DateTime<Utc>,
    ) -> impl Future<Output = Result<(), AuthStoreError>> + Send;

    /// Revokes a single token. Idempotent.
    fn revoke_refresh_token(
        &self,
        id: Uuid,
    ) -> impl Future<Output = Result<u64, AuthStoreError>> + Send;

    /// Revokes a token and every successor in its rotation chain,
    /// following `replaced_by` recursively.
    fn revoke_refresh_chain(
        &self,
        id: Uuid,
    ) -> impl Future<Output = Result<u64, AuthStoreError>> + Send;
}
