use std::collections::HashMap;

use chrono::{DateTime, Utc};
use sqlx::types::Json;
use uuid::Uuid;

use lemma_core::Message as CoreMessage;
use lemma_model::ApiFormat;

use crate::message::{Message, MessageBody, MessageStatus};
use crate::session::Session;
use crate::session_error::SessionError;
use crate::tree;

use super::message_update::MessageUpdate;
use super::session_tree::{BranchTarget, SessionTree};
use super::sessions::SessionService;

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
        let api_format = entry.api_format.map(ApiFormat::as_str);
        sqlx::query(
            "INSERT INTO messages (
                 id, session_id, parent_id, body, status, error,
                 provider_id, model, api_format, label, created_at, updated_at
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
        .bind(entry.label)
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
                    provider_id, model, api_format, label, created_at, updated_at
             FROM messages
             WHERE session_id = ?
             ORDER BY created_at ASC, id ASC",
        )
        .bind(session_id)
        .fetch_all(&self.db)
        .await?;
        rows.into_iter().map(message_from_row).collect()
    }

    /// Resolves the parent message id and inherited assistant API format for
    /// starting or branching a turn.
    ///
    /// # Errors
    ///
    /// [`SessionError::NotFound`] when no such session exists,
    /// [`SessionError::MessageNotFound`] when `BranchTarget::Message` names a
    /// message absent from the session, [`SessionError::InvalidBranchPoint`]
    /// when the target is streaming or not a valid turn boundary,
    /// [`SessionError::Missing`] when a tree ancestor is absent, and
    /// [`SessionError::Store`] when the database fails.
    pub async fn resolve_branch_parent(
        &self,
        session_id: Uuid,
        target: BranchTarget,
    ) -> Result<(Session, Option<Uuid>, Option<ApiFormat>), SessionError> {
        let session = self.find(session_id).await?.ok_or(SessionError::NotFound)?;
        let entries = self.all_messages(session_id).await?;
        let parent_id = match target {
            BranchTarget::ActiveLeaf => {
                if let Some(id) = session.leaf_id {
                    let entry = entries.iter().find(|entry| entry.id == id).ok_or_else(|| {
                        SessionError::Missing(format!("node {id} missing in tree"))
                    })?;
                    if entry.status == MessageStatus::Streaming {
                        return Err(SessionError::InvalidBranchPoint);
                    }
                }
                session.leaf_id
            }
            BranchTarget::Root => None,
            BranchTarget::Message(id) => {
                tree::is_valid_turn_boundary(id, &entries)?;
                Some(id)
            }
        };
        let by_id: HashMap<_, _> = entries.iter().map(|entry| (entry.id, entry)).collect();
        let mut api_format = None;
        let mut current = parent_id;
        while let Some(id) = current {
            let entry = by_id
                .get(&id)
                .ok_or_else(|| SessionError::Missing(format!("node {id} missing in tree")))?;
            if matches!(&entry.body.0, CoreMessage::Assistant { .. }) {
                api_format = entry.api_format;
                break;
            }
            current = entry.parent_id;
        }
        Ok((session, parent_id, api_format))
    }

    /// Loads the session's active leaf id and every message ordered oldest
    /// first inside one database transaction.
    ///
    /// # Errors
    ///
    /// [`SessionError::NotFound`] when no such session exists and
    /// [`SessionError::Store`] when the database fails.
    pub async fn list_messages(&self, session_id: Uuid) -> Result<SessionTree, SessionError> {
        let mut tx = self.db.begin().await?;
        let Some((leaf_id,)) =
            sqlx::query_as::<_, (Option<Uuid>,)>("SELECT leaf_id FROM sessions WHERE id = ?")
                .bind(session_id)
                .fetch_optional(&mut *tx)
                .await?
        else {
            return Err(SessionError::NotFound);
        };
        let rows = sqlx::query_as::<_, MessageRow>(
            "SELECT id, session_id, parent_id, body, status, error,
                    provider_id, model, api_format, label, created_at, updated_at
             FROM messages
             WHERE session_id = ?
             ORDER BY created_at ASC, id ASC",
        )
        .bind(session_id)
        .fetch_all(&mut *tx)
        .await?;
        tx.commit().await?;
        let messages = rows
            .into_iter()
            .map(message_from_row)
            .collect::<Result<Vec<_>, _>>()?;
        Ok(SessionTree { leaf_id, messages })
    }

    /// Sets or clears a branch label on a message belonging to `session_id`.
    ///
    /// # Errors
    ///
    /// [`SessionError::MessageNotFound`] when no message in `session_id` has
    /// `message_id`, and [`SessionError::Store`] when the database fails.
    pub async fn set_message_label(
        &self,
        session_id: Uuid,
        message_id: Uuid,
        label: &str,
    ) -> Result<Message, SessionError> {
        let trimmed = label.trim();
        let label = (!trimmed.is_empty()).then(|| trimmed.to_owned());
        let row = sqlx::query_as::<_, MessageRow>(
            "UPDATE messages
             SET label = ?, updated_at = ?
             WHERE id = ? AND session_id = ?
             RETURNING id, session_id, parent_id, body, status, error,
                       provider_id, model, api_format, label, created_at, updated_at",
        )
        .bind(label)
        .bind(Utc::now())
        .bind(message_id)
        .bind(session_id)
        .fetch_optional(&self.db)
        .await?;
        row.map(message_from_row)
            .transpose()?
            .ok_or(SessionError::MessageNotFound)
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
        label,
        created_at,
        updated_at,
    ): MessageRow,
) -> Result<Message, SessionError> {
    let status = MessageStatus::parse(&status)?;
    let api_format = match api_format.as_deref() {
        Some(raw) => {
            let Some(parsed) = ApiFormat::parse(raw) else {
                return Err(SessionError::Store(format!("unknown api format: {raw}")));
            };
            Some(parsed)
        }
        None => None,
    };
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
        label,
        created_at,
        updated_at,
    })
}
