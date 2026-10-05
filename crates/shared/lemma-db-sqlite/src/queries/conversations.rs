//! Queries for the conversations and messages tables.

use sqlx::Sqlite;
use uuid::Uuid;

use crate::entity::{Conversation, Message};
use crate::now_ms;

/// Creates an empty conversation and returns it.
pub async fn insert<'e, E>(executor: E, user_id: Uuid) -> sqlx::Result<Conversation>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    let now = now_ms();
    sqlx::query_as::<_, Conversation>(
        r#"
        INSERT INTO conversations (id, user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(now)
    .bind(now)
    .fetch_one(executor)
    .await
}

/// Lists a user's active conversations, most recently updated first.
pub async fn list_active_by_user<'e, E>(
    executor: E,
    user_id: Uuid,
) -> sqlx::Result<Vec<Conversation>>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query_as::<_, Conversation>(
        "SELECT * FROM conversations WHERE user_id = ? AND status = 'active' ORDER BY updated_at DESC",
    )
    .bind(user_id)
    .fetch_all(executor)
    .await
}

/// Lists a user's archived conversations, most recently archived first.
pub async fn list_archived_by_user<'e, E>(
    executor: E,
    user_id: Uuid,
) -> sqlx::Result<Vec<Conversation>>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query_as::<_, Conversation>(
        "SELECT * FROM conversations WHERE user_id = ? AND status = 'archived' ORDER BY archived_at DESC",
    )
    .bind(user_id)
    .fetch_all(executor)
    .await
}

/// Finds a conversation owned by the given user, any status.
pub async fn find_by_id_and_user<'e, E>(
    executor: E,
    id: Uuid,
    user_id: Uuid,
) -> sqlx::Result<Option<Conversation>>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query_as::<_, Conversation>("SELECT * FROM conversations WHERE id = ? AND user_id = ?")
        .bind(id)
        .bind(user_id)
        .fetch_optional(executor)
        .await
}

/// Renames a conversation owned by the given user.
pub async fn rename<'e, E>(
    executor: E,
    id: Uuid,
    user_id: Uuid,
    title: &str,
) -> sqlx::Result<Option<Conversation>>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query_as::<_, Conversation>(
        r#"
        UPDATE conversations
        SET title = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
        RETURNING *
        "#,
    )
    .bind(title)
    .bind(now_ms())
    .bind(id)
    .bind(user_id)
    .fetch_optional(executor)
    .await
}

/// Archives an active conversation without touching its messages.
/// Returns `None` unless the conversation is currently active.
pub async fn archive<'e, E>(
    executor: E,
    id: Uuid,
    user_id: Uuid,
) -> sqlx::Result<Option<Conversation>>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    let now = now_ms();
    sqlx::query_as::<_, Conversation>(
        r#"
        UPDATE conversations
        SET status = 'archived',
            archived_at = ?,
            updated_at = ?
        WHERE id = ? AND user_id = ? AND status = 'active'
        RETURNING *
        "#,
    )
    .bind(now)
    .bind(now)
    .bind(id)
    .bind(user_id)
    .fetch_optional(executor)
    .await
}

/// Restores an archived conversation to active, clearing the archive
/// metadata. Returns `None` unless the conversation is currently
/// archived.
pub async fn restore<'e, E>(
    executor: E,
    id: Uuid,
    user_id: Uuid,
) -> sqlx::Result<Option<Conversation>>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query_as::<_, Conversation>(
        r#"
        UPDATE conversations
        SET status = 'active', archived_at = NULL,
            updated_at = ?
        WHERE id = ? AND user_id = ? AND status = 'archived'
        RETURNING *
        "#,
    )
    .bind(now_ms())
    .bind(id)
    .bind(user_id)
    .fetch_optional(executor)
    .await
}

/// Deletes an archived conversation. Active conversations are not
/// deletable through this path.
pub async fn delete_archived<'e, E>(executor: E, id: Uuid, user_id: Uuid) -> sqlx::Result<bool>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query("DELETE FROM conversations WHERE id = ? AND user_id = ? AND status = 'archived'")
        .bind(id)
        .bind(user_id)
        .execute(executor)
        .await
        .map(|r| r.rows_affected() > 0)
}

/// Keyset-paginates a conversation's messages newest-first. `before_id`
/// selects messages older than that message; one extra row is fetched to
/// compute `has_more`.
pub async fn list_messages<'e, E>(
    executor: E,
    conversation_id: Uuid,
    before_id: Option<Uuid>,
    limit: i64,
) -> sqlx::Result<(Vec<Message>, bool)>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    let rows: Vec<Message> = if let Some(before) = before_id {
        sqlx::query_as::<_, Message>(
            r#"
            SELECT m.* FROM messages m
            JOIN messages b ON b.id = ? AND b.conversation_id = ?
            WHERE m.conversation_id = ?
              AND (m.created_at, m.id) < (b.created_at, b.id)
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT ?
            "#,
        )
        .bind(before)
        .bind(conversation_id)
        .bind(conversation_id)
        .bind(limit + 1)
        .fetch_all(executor)
        .await?
    } else {
        sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
        )
        .bind(conversation_id)
        .bind(limit + 1)
        .fetch_all(executor)
        .await?
    };
    let has_more = rows.len() as i64 > limit;
    let messages = if has_more {
        rows[..rows.len() - 1].to_vec()
    } else {
        rows
    };
    Ok((messages, has_more))
}
