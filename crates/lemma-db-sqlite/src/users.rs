//! Queries for the users table.

use sqlx::Sqlite;
use uuid::Uuid;

use crate::entity::User;
use crate::now_ms;

/// Inserts a user and returns it. The very first user becomes the owner;
/// everyone after that is normal.
pub async fn insert<'e, E>(executor: E, username: &str, email: &str) -> sqlx::Result<User>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    let now = now_ms();
    sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (id, username, email, role, created_at, updated_at)
        VALUES (?, ?, ?,
            CASE WHEN EXISTS (SELECT 1 FROM users WHERE role = 'owner')
                THEN 'normal' ELSE 'owner' END,
            ?, ?)
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
pub async fn find_by_login<'e, E>(executor: E, login: &str) -> sqlx::Result<Option<User>>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = ? OR email = ?")
        .bind(login)
        .bind(login)
        .fetch_optional(executor)
        .await
}

/// Finds a user by id.
pub async fn find_by_id<'e, E>(executor: E, id: Uuid) -> sqlx::Result<Option<User>>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
        .bind(id)
        .fetch_optional(executor)
        .await
}
