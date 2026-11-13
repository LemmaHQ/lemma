use std::collections::HashMap;

use chrono::{DateTime, Utc};
use sqlx::types::Json;
use uuid::Uuid;

use lemma_model::ApiFormat;

use crate::message::{self, Message, MessageBody, MessageStatus};
use crate::session_error::SessionError;

use super::message_page::MessagePage;
use super::message_update::MessageUpdate;
use super::sessions::SessionService;

const DEFAULT_PAGE_LEN: i32 = 50;

type MessageRow = (
    Uuid,
    Uuid,
    Option<Uuid>,
    Json<MessageBody>,
    String,
    Option<String>,
    Option<Uuid>,
    Option<String>,
    Option<String>,
    DateTime<Utc>,
    DateTime<Utc>,
);

impl SessionService {
    /// Appends a new message node into the tree.
    ///
    /// # Errors
    ///
    /// [`SessionError::Store`] when the database fails, including a
    /// session that does not exist.
    pub async fn append_message(&self, entry: Message) -> Result<(), SessionError> {
        let api_format = entry.api_format.map(message::api_format_str);
        sqlx::query(
            "INSERT INTO messages (
                 id, session_id, parent_id, body, status, error,
                 provider_id, model, api_format, created_at, updated_at
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(entry.id)
        .bind(entry.session_id)
        .bind(entry.parent_id)
        .bind(Json(entry.body))
        .bind(entry.status.as_str())
        .bind(entry.error)
        .bind(entry.provider_id)
        .bind(entry.model)
        .bind(api_format)
        .bind(entry.created_at)
        .bind(entry.updated_at)
        .execute(&self.db)
        .await?;
        Ok(())
    }

    /// Finalizes a placeholder message with its settled body and status.
    ///
    /// # Errors
    ///
    /// [`SessionError::Store`] when the database fails.
    pub async fn update_message(
        &self,
        id: Uuid,
        update: MessageUpdate,
    ) -> Result<(), SessionError> {
        sqlx::query(
            "UPDATE messages
             SET body = ?, status = ?, error = ?, updated_at = ?
             WHERE id = ?",
        )
        .bind(Json(update.body))
        .bind(update.status.as_str())
        .bind(update.error)
        .bind(Utc::now())
        .bind(id)
        .execute(&self.db)
        .await?;
        Ok(())
    }

    /// Retrieves every message of a session, oldest first.
    ///
    /// # Errors
    ///
    /// [`SessionError::Store`] when the database fails.
    pub async fn all_messages(&self, session_id: Uuid) -> Result<Vec<Message>, SessionError> {
        let rows = sqlx::query_as::<_, MessageRow>(
            "SELECT id, session_id, parent_id, body, status, error,
                    provider_id, model, api_format, created_at, updated_at
             FROM messages
             WHERE session_id = ?
             ORDER BY created_at ASC, id ASC",
        )
        .bind(session_id)
        .fetch_all(&self.db)
        .await?;
        rows.into_iter().map(message_from_row).collect()
    }

    /// Returns the API format of the latest assistant message on the active
    /// context path, or `None` when no assistant message or format exists.
    ///
    /// # Errors
    ///
    /// [`SessionError::NotFound`] when no such session exists,
    /// [`SessionError::Missing`] when a context-path node is absent, and
    /// [`SessionError::Store`] when the database fails.
    pub async fn previous_assistant_api_format(
        &self,
        session_id: Uuid,
    ) -> Result<Option<ApiFormat>, SessionError> {
        let session = self.find(session_id).await?.ok_or(SessionError::NotFound)?;
        let Some(leaf_id) = session.leaf_id else {
            return Ok(None);
        };
        let entries = self.all_messages(session_id).await?;
        let by_id: HashMap<_, _> = entries.iter().map(|entry| (entry.id, entry)).collect();
        let mut current = Some(leaf_id);
        while let Some(id) = current {
            let entry = by_id
                .get(&id)
                .ok_or_else(|| SessionError::Missing(format!("node {id} missing in tree")))?;
            if matches!(&entry.body.0, lemma_core::Message::Assistant { .. }) {
                return Ok(entry.api_format);
            }
            current = entry.parent_id;
        }
        Ok(None)
    }

    /// Lists a session's messages newest-first with keyset
    /// pagination: `before_id` selects messages older than that message,
    /// and an unknown `before_id` yields an empty page. A `limit` that is
    /// not positive, as when the request omits it, returns 50 messages.
    ///
    /// # Errors
    ///
    /// [`SessionError::NotFound`] when no such session exists and
    /// [`SessionError::Store`] when the database fails.
    pub async fn list_messages(
        &self,
        session_id: Uuid,
        before_id: Option<Uuid>,
        limit: i32,
    ) -> Result<MessagePage, SessionError> {
        self.find(session_id).await?.ok_or(SessionError::NotFound)?;
        let page_len = if limit > 0 { limit } else { DEFAULT_PAGE_LEN };
        let fetch_limit = i64::from(page_len) + 1;
        let rows = if let Some(before_id) = before_id {
            let Some((before_created_at, before_row_id)) =
                sqlx::query_as::<_, (DateTime<Utc>, Uuid)>(
                    "SELECT created_at, id FROM messages WHERE id = ? AND session_id = ?",
                )
                .bind(before_id)
                .bind(session_id)
                .fetch_optional(&self.db)
                .await?
            else {
                return Ok(MessagePage {
                    messages: Vec::new(),
                    has_more: false,
                });
            };
            sqlx::query_as::<_, MessageRow>(
                "SELECT id, session_id, parent_id, body, status, error,
                        provider_id, model, api_format, created_at, updated_at
                 FROM messages
                 WHERE session_id = ? AND (created_at, id) < (?, ?)
                 ORDER BY created_at DESC, id DESC
                 LIMIT ?",
            )
            .bind(session_id)
            .bind(before_created_at)
            .bind(before_row_id)
            .bind(fetch_limit)
            .fetch_all(&self.db)
            .await?
        } else {
            sqlx::query_as::<_, MessageRow>(
                "SELECT id, session_id, parent_id, body, status, error,
                        provider_id, model, api_format, created_at, updated_at
                 FROM messages
                 WHERE session_id = ?
                 ORDER BY created_at DESC, id DESC
                 LIMIT ?",
            )
            .bind(session_id)
            .bind(fetch_limit)
            .fetch_all(&self.db)
            .await?
        };
        let mut messages: Vec<Message> = rows
            .into_iter()
            .map(message_from_row)
            .collect::<Result<_, _>>()?;
        let page_len = page_len as usize;
        let has_more = messages.len() > page_len;
        messages.truncate(page_len);
        Ok(MessagePage { messages, has_more })
    }
}

fn message_from_row(
    (
        id,
        session_id,
        parent_id,
        body,
        status,
        error,
        provider_id,
        model,
        api_format,
        created_at,
        updated_at,
    ): MessageRow,
) -> Result<Message, SessionError> {
    let status = MessageStatus::parse(&status)?;
    let api_format = api_format
        .as_deref()
        .map(message::parse_api_format)
        .transpose()?;
    Ok(Message {
        id,
        session_id,
        parent_id,
        body: body.0,
        status,
        error,
        provider_id,
        model,
        api_format,
        created_at,
        updated_at,
    })
}
