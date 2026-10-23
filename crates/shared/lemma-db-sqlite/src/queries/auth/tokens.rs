//! Queries for the `refresh_tokens` table.

use sqlx::Sqlite;
use uuid::Uuid;

use crate::clock;
use crate::entity::RefreshToken;

/// Inserts a refresh token row.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn insert<'conn, E>(
    executor: E,
    id: Uuid,
    user_id: Uuid,
    token_hash: &str,
    expires_at: i64,
) -> sqlx::Result<()>
where
    E: sqlx::Executor<'conn, Database = Sqlite>,
{
    sqlx::query(
        r#"
        INSERT INTO refresh_tokens (id, user_id, token_hash, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
        "#,
    )
    .bind(id)
    .bind(user_id)
    .bind(token_hash)
    .bind(clock::now_ms())
    .bind(expires_at)
    .execute(executor)
    .await
    .map(|_| ())
}

/// Inserts the rotation successor of a consumed token, inheriting its
/// owner. Returns the number of rows inserted: zero when the consumed token is missing.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn insert_successor<'conn, E>(
    executor: E,
    id: Uuid,
    new_id: Uuid,
    new_token_hash: &str,
    new_expires_at: i64,
) -> sqlx::Result<u64>
where
    E: sqlx::Executor<'conn, Database = Sqlite>,
{
    sqlx::query(
        r#"
        INSERT INTO refresh_tokens (id, user_id, token_hash, created_at, expires_at)
        SELECT ?, user_id, ?, ?, ? FROM refresh_tokens WHERE id = ?
        "#,
    )
    .bind(new_id)
    .bind(new_token_hash)
    .bind(clock::now_ms())
    .bind(new_expires_at)
    .bind(id)
    .execute(executor)
    .await
    .map(|r| r.rows_affected())
}

/// Looks up a token row by its SHA-256 hash.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn find_by_hash<'conn, E>(
    executor: E,
    token_hash: &str,
) -> sqlx::Result<Option<RefreshToken>>
where
    E: sqlx::Executor<'conn, Database = Sqlite>,
{
    sqlx::query_as::<_, RefreshToken>("SELECT * FROM refresh_tokens WHERE token_hash = ?")
        .bind(token_hash)
        .fetch_optional(executor)
        .await
}

/// Links a consumed token to its rotation successor.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn mark_replaced<'conn, E>(executor: E, id: Uuid, replaced_by: Uuid) -> sqlx::Result<u64>
where
    E: sqlx::Executor<'conn, Database = Sqlite>,
{
    sqlx::query("UPDATE refresh_tokens SET replaced_by = ? WHERE id = ?")
        .bind(replaced_by)
        .bind(id)
        .execute(executor)
        .await
        .map(|r| r.rows_affected())
}

/// Revokes a single token. Idempotent.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn revoke<'conn, E>(executor: E, id: Uuid) -> sqlx::Result<u64>
where
    E: sqlx::Executor<'conn, Database = Sqlite>,
{
    sqlx::query("UPDATE refresh_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
        .bind(clock::now_ms())
        .bind(id)
        .execute(executor)
        .await
        .map(|r| r.rows_affected())
}

/// Revokes a token and every successor in its rotation chain, following
/// `replaced_by` recursively.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn revoke_chain<'conn, E>(executor: E, id: Uuid) -> sqlx::Result<u64>
where
    E: sqlx::Executor<'conn, Database = Sqlite>,
{
    sqlx::query(
        r#"
        WITH RECURSIVE chain AS (
            SELECT id, replaced_by FROM refresh_tokens WHERE id = ?
            UNION ALL
            SELECT r.id, r.replaced_by FROM refresh_tokens r
                JOIN chain c ON r.id = c.replaced_by
        )
        UPDATE refresh_tokens SET revoked_at = ?
        WHERE id IN (SELECT id FROM chain) AND revoked_at IS NULL
        "#,
    )
    .bind(id)
    .bind(clock::now_ms())
    .execute(executor)
    .await
    .map(|r| r.rows_affected())
}
