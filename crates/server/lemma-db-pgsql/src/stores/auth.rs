//! `AuthStore` implementation over the users and auth queries.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use lemma_auth::{AuthStore, AuthStoreError, BoxAuthFuture, RefreshToken, User};

use crate::entity;
use crate::queries::auth::{credentials, tokens};
use crate::queries::users;

fn into_user(u: entity::User) -> User {
    User {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        created_at: u.created_at,
        updated_at: u.updated_at,
    }
}

fn into_token(t: entity::RefreshToken) -> RefreshToken {
    RefreshToken {
        id: t.id,
        user_id: t.user_id,
        token_hash: t.token_hash,
        label: t.label,
        replaced_by: t.replaced_by,
        revoked_at: t.revoked_at,
        created_at: t.created_at,
        expires_at: t.expires_at,
    }
}

fn store_err(e: sqlx::Error) -> AuthStoreError {
    AuthStoreError::Db(e.to_string())
}

fn unique_violation(e: &sqlx::Error, constraint: &str) -> bool {
    matches!(e, sqlx::Error::Database(db) if db.is_unique_violation() && db.constraint() == Some(constraint))
}

/// [`AuthStore`] backed by a PostgreSQL pool.
pub struct PgAuthStore {
    pool: sqlx::PgPool,
}

impl PgAuthStore {
    /// Creates the store over a pool.
    pub fn new(pool: sqlx::PgPool) -> Self {
        Self { pool }
    }
}

impl AuthStore for PgAuthStore {
    fn create_user_with_credential<'a>(
        &'a self,
        username: &'a str,
        email: &'a str,
        password_hash: &'a str,
    ) -> BoxAuthFuture<'a, User> {
        Box::pin(async move {
            const ATTEMPTS: u32 = 3;
            for attempt in 1..=ATTEMPTS {
                let mut tx = self.pool.begin().await.map_err(store_err)?;
                let result = async {
                    let user = users::insert(&mut *tx, username, email).await?;
                    credentials::upsert(&mut *tx, user.id, password_hash).await?;
                    Ok::<_, sqlx::Error>(user)
                }
                .await;
                let user = match result {
                    Ok(user) => user,
                    Err(e) => {
                        if unique_violation(&e, "users_username_key")
                            || unique_violation(&e, "users_email_key")
                        {
                            return Err(AuthStoreError::UsernameTaken);
                        }
                        if unique_violation(&e, "users_owner_unique") && attempt < ATTEMPTS {
                            continue;
                        }
                        return Err(store_err(e));
                    }
                };
                tx.commit().await.map_err(store_err)?;
                return Ok(into_user(user));
            }
            unreachable!()
        })
    }

    fn find_user_by_login<'a>(&'a self, login: &'a str) -> BoxAuthFuture<'a, Option<User>> {
        Box::pin(async move {
            users::find_by_login(&self.pool, login)
                .await
                .map(|row| row.map(into_user))
                .map_err(store_err)
        })
    }

    fn find_user_by_id<'a>(&'a self, id: Uuid) -> BoxAuthFuture<'a, Option<User>> {
        Box::pin(async move {
            users::find_by_id(&self.pool, id)
                .await
                .map(|row| row.map(into_user))
                .map_err(store_err)
        })
    }

    fn password_hash<'a>(&'a self, user_id: Uuid) -> BoxAuthFuture<'a, Option<String>> {
        Box::pin(async move {
            credentials::password_hash(&self.pool, user_id)
                .await
                .map_err(store_err)
        })
    }

    fn insert_refresh_token<'a>(
        &'a self,
        id: Uuid,
        user_id: Uuid,
        token_hash: &'a str,
        label: Option<&'a str>,
        expires_at: DateTime<Utc>,
    ) -> BoxAuthFuture<'a, RefreshToken> {
        Box::pin(async move {
            tokens::insert(&self.pool, id, user_id, token_hash, label, expires_at)
                .await
                .map(into_token)
                .map_err(store_err)
        })
    }

    fn find_refresh_token_by_hash<'a>(
        &'a self,
        token_hash: &'a str,
    ) -> BoxAuthFuture<'a, Option<RefreshToken>> {
        Box::pin(async move {
            tokens::find_by_hash(&self.pool, token_hash)
                .await
                .map(|row| row.map(into_token))
                .map_err(store_err)
        })
    }

    fn rotate_refresh_token<'a>(
        &'a self,
        id: Uuid,
        new_id: Uuid,
        new_token_hash: &'a str,
        new_expires_at: DateTime<Utc>,
    ) -> BoxAuthFuture<'a, RefreshToken> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(store_err)?;
            let token =
                tokens::insert_successor(&mut *tx, id, new_id, new_token_hash, new_expires_at)
                    .await
                    .map_err(store_err)?
                    .ok_or_else(|| AuthStoreError::Db(format!("refresh token not found: {id}")))?;
            tokens::mark_replaced(&mut *tx, id, new_id)
                .await
                .map_err(store_err)?;
            tx.commit().await.map_err(store_err)?;
            Ok(into_token(token))
        })
    }

    fn revoke_refresh_token<'a>(&'a self, id: Uuid) -> BoxAuthFuture<'a, u64> {
        Box::pin(async move { tokens::revoke(&self.pool, id).await.map_err(store_err) })
    }

    fn revoke_refresh_chain<'a>(&'a self, id: Uuid) -> BoxAuthFuture<'a, u64> {
        Box::pin(async move {
            tokens::revoke_chain(&self.pool, id)
                .await
                .map_err(store_err)
        })
    }
}
