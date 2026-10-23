//! Queries for the `auth_credentials` table.

use sqlx::Sqlite;
use uuid::Uuid;

use crate::clock;

/// Inserts or replaces an account's password hash.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn upsert<'conn, E>(executor: E, user_id: Uuid, password_hash: &str) -> sqlx::Result<()>
where
    E: sqlx::Executor<'conn, Database = Sqlite>,
{
    let now = clock::now_ms();
    sqlx::query(
        r#"
        INSERT INTO auth_credentials (user_id, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (user_id) DO UPDATE
        SET password_hash = excluded.password_hash, updated_at = excluded.updated_at
        "#,
    )
    .bind(user_id)
    .bind(password_hash)
    .bind(now)
    .bind(now)
    .execute(executor)
    .await?;
    Ok(())
}

/// Returns the account's password hash, when credentials exist.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn password_hash<'conn, E>(executor: E, user_id: Uuid) -> sqlx::Result<Option<String>>
where
    E: sqlx::Executor<'conn, Database = Sqlite>,
{
    sqlx::query_scalar("SELECT password_hash FROM auth_credentials WHERE user_id = ?")
        .bind(user_id)
        .fetch_optional(executor)
        .await
}
