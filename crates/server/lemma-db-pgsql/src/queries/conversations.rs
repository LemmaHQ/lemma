//! Queries for the conversations and messages tables.

use uuid::Uuid;

use crate::entity::{Conversation, Message, MessagePage};

/// Creates an empty conversation and returns it.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn insert<'conn, E>(executor: E, user_id: Uuid) -> sqlx::Result<Conversation>
where
    E: sqlx::Executor<'conn, Database = sqlx::Postgres>,
{
    sqlx::query_as::<_, Conversation>("INSERT INTO conversations (user_id) VALUES ($1) RETURNING *")
        .bind(user_id)
        .fetch_one(executor)
        .await
}

/// Lists a user's conversations, most recently updated first.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn list_by_user<'conn, E>(executor: E, user_id: Uuid) -> sqlx::Result<Vec<Conversation>>
where
    E: sqlx::Executor<'conn, Database = sqlx::Postgres>,
{
    sqlx::query_as::<_, Conversation>(
        "SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC",
    )
    .bind(user_id)
    .fetch_all(executor)
    .await
}

/// Finds a conversation owned by the given user.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn find_by_id_and_user<'conn, E>(
    executor: E,
    id: Uuid,
    user_id: Uuid,
) -> sqlx::Result<Option<Conversation>>
where
    E: sqlx::Executor<'conn, Database = sqlx::Postgres>,
{
    sqlx::query_as::<_, Conversation>("SELECT * FROM conversations WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .fetch_optional(executor)
        .await
}

/// Renames a conversation owned by the given user.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn rename<'conn, E>(
    executor: E,
    id: Uuid,
    user_id: Uuid,
    title: &str,
) -> sqlx::Result<Option<Conversation>>
where
    E: sqlx::Executor<'conn, Database = sqlx::Postgres>,
{
    sqlx::query_as::<_, Conversation>(
        r#"
        UPDATE conversations
        SET title = $3, updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(user_id)
    .bind(title)
    .fetch_optional(executor)
    .await
}

/// Deletes a conversation owned by the given user; messages cascade.
/// Returns whether a row was removed.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn delete<'conn, E>(executor: E, id: Uuid, user_id: Uuid) -> sqlx::Result<bool>
where
    E: sqlx::Executor<'conn, Database = sqlx::Postgres>,
{
    sqlx::query("DELETE FROM conversations WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(executor)
        .await
        .map(|r| r.rows_affected() > 0)
}

/// Keyset-paginates a conversation's messages newest-first. `before_id`
/// selects messages older than that message; one extra row is fetched to
/// compute `has_more`.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn list_messages<'conn, E>(
    executor: E,
    conversation_id: Uuid,
    before_id: Option<Uuid>,
    limit: i64,
) -> sqlx::Result<MessagePage>
where
    E: sqlx::Executor<'conn, Database = sqlx::Postgres>,
{
    let mut messages: Vec<Message> = if let Some(before) = before_id {
        sqlx::query_as::<_, Message>(
            r#"
            SELECT m.* FROM messages m
            JOIN messages b ON b.id = $2 AND b.conversation_id = $1
            WHERE m.conversation_id = $1
              AND (m.created_at, m.id) < (b.created_at, b.id)
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT $3
            "#,
        )
        .bind(conversation_id)
        .bind(before)
        .bind(limit + 1)
        .fetch_all(executor)
        .await?
    } else {
        sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2",
        )
        .bind(conversation_id)
        .bind(limit + 1)
        .fetch_all(executor)
        .await?
    };
    let page_len = usize::try_from(limit).unwrap_or(0);
    let has_more = messages.len() > page_len;
    messages.truncate(page_len);
    Ok(MessagePage { messages, has_more })
}
