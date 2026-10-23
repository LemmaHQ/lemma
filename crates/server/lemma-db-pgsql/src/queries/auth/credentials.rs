//! Queries for the `auth_credentials` table.

use uuid::Uuid;

/// Inserts or replaces an account's password hash.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn upsert<'conn, E>(executor: E, user_id: Uuid, password_hash: &str) -> sqlx::Result<()>
where
    E: sqlx::Executor<'conn, Database = sqlx::Postgres>,
{
    sqlx::query(
        r#"
        INSERT INTO auth_credentials (user_id, password_hash)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET password_hash = $2, updated_at = now()
        "#,
    )
    .bind(user_id)
    .bind(password_hash)
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
    E: sqlx::Executor<'conn, Database = sqlx::Postgres>,
{
    sqlx::query_scalar("SELECT password_hash FROM auth_credentials WHERE user_id = $1")
        .bind(user_id)
        .fetch_optional(executor)
        .await
}
