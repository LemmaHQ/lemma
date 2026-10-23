//! Queries for the users table.

use crate::entity::User;

/// Inserts a user and returns it.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn insert<'conn, E>(executor: E, username: &str, email: &str) -> sqlx::Result<User>
where
    E: sqlx::Executor<'conn, Database = sqlx::Postgres>,
{
    sqlx::query_as::<_, User>("INSERT INTO users (username, email) VALUES ($1, $2) RETURNING *")
        .bind(username)
        .bind(email)
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
    E: sqlx::Executor<'conn, Database = sqlx::Postgres>,
{
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = $1 OR email = $1")
        .bind(login)
        .fetch_optional(executor)
        .await
}

/// Finds a user by id.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn find_by_id<'conn, E>(executor: E, id: uuid::Uuid) -> sqlx::Result<Option<User>>
where
    E: sqlx::Executor<'conn, Database = sqlx::Postgres>,
{
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(executor)
        .await
}
