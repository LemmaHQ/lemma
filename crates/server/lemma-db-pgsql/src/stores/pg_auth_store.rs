//! `AuthStore` implementation over the users and auth queries.

use chrono::{DateTime, Utc};
use lemma_auth::{AuthStore, AuthStoreError, RefreshToken, User};
use sqlx::PgPool;
use uuid::Uuid;

use crate::entity;
use crate::queries::auth::{credentials, tokens};
use crate::queries::users;

fn into_user(u: entity::User) -> User {
    User {
        id: u.id,
        username: u.username,
        email: u.email,
        created_at: u.created_at,
        updated_at: u.updated_at,
    }
}

fn into_token(t: entity::RefreshToken) -> RefreshToken {
    RefreshToken {
        id: t.id,
        user_id: t.user_id,
        token_hash: t.token_hash,
        replaced_by: t.replaced_by,
        revoked_at: t.revoked_at,
        created_at: t.created_at,
        expires_at: t.expires_at,
    }
}

#[expect(clippy::needless_pass_by_value, reason = "used as a map_err function")]
fn store_err(e: sqlx::Error) -> AuthStoreError {
    AuthStoreError::Db(e.to_string())
}

fn unique_violation(e: &sqlx::Error, constraint: &str) -> bool {
    matches!(e, sqlx::Error::Database(db) if db.is_unique_violation() && db.constraint() == Some(constraint))
}

/// [`AuthStore`] backed by a PostgreSQL pool.
#[derive(Debug, Clone)]
pub struct PgAuthStore {
    pool: PgPool,
}

impl PgAuthStore {
    /// Creates the store over a pool.
    #[must_use]
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

impl AuthStore for PgAuthStore {
    async fn create_user_with_credential(
        &self,
        username: &str,
        email: &str,
        password_hash: &str,
    ) -> Result<User, AuthStoreError> {
        let mut tx = self.pool.begin().await.map_err(store_err)?;
        let user = users::insert(&mut *tx, username, email)
            .await
            .map_err(|e| {
                if unique_violation(&e, "users_username_key")
                    || unique_violation(&e, "users_email_key")
                {
                    AuthStoreError::UsernameTaken
                } else {
                    store_err(e)
                }
            })?;
        credentials::upsert(&mut *tx, user.id, password_hash)
            .await
            .map_err(store_err)?;
        tx.commit().await.map_err(store_err)?;
        Ok(into_user(user))
    }

    async fn find_user_by_login(&self, login: &str) -> Result<Option<User>, AuthStoreError> {
        users::find_by_login(&self.pool, login)
            .await
            .map(|row| row.map(into_user))
            .map_err(store_err)
    }

    async fn find_user_by_id(&self, id: Uuid) -> Result<Option<User>, AuthStoreError> {
        users::find_by_id(&self.pool, id)
            .await
            .map(|row| row.map(into_user))
            .map_err(store_err)
    }

    async fn password_hash(&self, user_id: Uuid) -> Result<Option<String>, AuthStoreError> {
        credentials::password_hash(&self.pool, user_id)
            .await
            .map_err(store_err)
    }

    async fn insert_refresh_token(
        &self,
        id: Uuid,
        user_id: Uuid,
        token_hash: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<(), AuthStoreError> {
        tokens::insert(&self.pool, id, user_id, token_hash, expires_at)
            .await
            .map_err(store_err)
    }

    async fn find_refresh_token_by_hash(
        &self,
        token_hash: &str,
    ) -> Result<Option<RefreshToken>, AuthStoreError> {
        tokens::find_by_hash(&self.pool, token_hash)
            .await
            .map(|row| row.map(into_token))
            .map_err(store_err)
    }

    async fn rotate_refresh_token(
        &self,
        id: Uuid,
        new_id: Uuid,
        new_token_hash: &str,
        new_expires_at: DateTime<Utc>,
    ) -> Result<(), AuthStoreError> {
        let mut tx = self.pool.begin().await.map_err(store_err)?;
        let inserted =
            tokens::insert_successor(&mut *tx, id, new_id, new_token_hash, new_expires_at)
                .await
                .map_err(store_err)?;
        if inserted == 0 {
            return Err(AuthStoreError::Db(format!("refresh token not found: {id}")));
        }
        tokens::mark_replaced(&mut *tx, id, new_id)
            .await
            .map_err(store_err)?;
        tx.commit().await.map_err(store_err)
    }

    async fn revoke_refresh_token(&self, id: Uuid) -> Result<u64, AuthStoreError> {
        tokens::revoke(&self.pool, id).await.map_err(store_err)
    }

    async fn revoke_refresh_chain(&self, id: Uuid) -> Result<u64, AuthStoreError> {
        tokens::revoke_chain(&self.pool, id)
            .await
            .map_err(store_err)
    }
}
