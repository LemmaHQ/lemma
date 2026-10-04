//! Queries for the auth_credentials table.

use sqlx::Sqlite;
use uuid::Uuid;

use crate::now_ms;

/// Inserts or replaces an account's password hash.
pub async fn upsert<'e, E>(executor: E, user_id: Uuid, password_hash: &str) -> sqlx::Result<()>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    let now = now_ms();
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
pub async fn password_hash<'e, E>(executor: E, user_id: Uuid) -> sqlx::Result<Option<String>>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query_scalar("SELECT password_hash FROM auth_credentials WHERE user_id = ?")
        .bind(user_id)
        .fetch_optional(executor)
        .await
}
