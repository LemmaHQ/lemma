//! Queries for the users table.

use sqlx::Sqlite;
use uuid::Uuid;

use crate::clock;
use crate::entity::User;

/// Inserts a user and returns it.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn insert<'conn, E>(executor: E, username: &str, email: &str) -> sqlx::Result<User>
where
    E: sqlx::Executor<'conn, Database = Sqlite>,
{
    let now = clock::now_ms();
    sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (id, username, email, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(username)
    .bind(email)
    .bind(now)
    .bind(now)
    .fetch_one(executor)
    .await
}

/// Finds a user by username or email; `login` matches either column.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn find_by_login<'conn, E>(executor: E, login: &str) -> sqlx::Result<Option<User>>
where
    E: sqlx::Executor<'conn, Database = Sqlite>,
{
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = ? OR email = ?")
        .bind(login)
        .bind(login)
        .fetch_optional(executor)
        .await
}

/// Finds a user by id.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn find_by_id<'conn, E>(executor: E, id: Uuid) -> sqlx::Result<Option<User>>
where
    E: sqlx::Executor<'conn, Database = Sqlite>,
{
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
        .bind(id)
        .fetch_optional(executor)
        .await
}
