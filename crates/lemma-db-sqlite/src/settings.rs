//! Queries for the settings table: per-account key-value configuration.

use sqlx::Sqlite;
use sqlx::types::Json;
use uuid::Uuid;

use crate::entity::Setting;
use crate::now_ms;

/// Reads one setting value.
pub async fn get<'e, E>(
    executor: E,
    user_id: Uuid,
    key: &str,
) -> sqlx::Result<Option<serde_json::Value>>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query_scalar("SELECT value FROM settings WHERE user_id = ? AND key = ?")
        .bind(user_id)
        .bind(key)
        .fetch_optional(executor)
        .await
        .map(|opt| opt.map(|Json(v)| v))
}

/// Upserts one setting value.
pub async fn set<'e, E>(
    executor: E,
    user_id: Uuid,
    key: &str,
    value: serde_json::Value,
) -> sqlx::Result<()>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query(
        r#"
        INSERT INTO settings (user_id, key, value, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        "#,
    )
    .bind(user_id)
    .bind(key)
    .bind(Json(value))
    .bind(now_ms())
    .execute(executor)
    .await?;
    Ok(())
}

/// Deletes one setting, returning whether row was removed.
pub async fn delete<'e, E>(executor: E, user_id: Uuid, key: &str) -> sqlx::Result<bool>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query("DELETE FROM settings WHERE user_id = ? AND key = ?")
        .bind(user_id)
        .bind(key)
        .execute(executor)
        .await
        .map(|r| r.rows_affected() > 0)
}

/// Lists all of an account's settings.
pub async fn list_by_user<'e, E>(executor: E, user_id: Uuid) -> sqlx::Result<Vec<Setting>>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query_as::<_, Setting>("SELECT * FROM settings WHERE user_id = ? ORDER BY key")
        .bind(user_id)
        .fetch_all(executor)
        .await
}
