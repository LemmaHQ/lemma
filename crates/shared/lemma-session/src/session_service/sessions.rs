use std::path::Path;

use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use sqlx::types::Json;
use tokio::fs;
use uuid::Uuid;

use crate::session::{LastModel, Session};
use crate::session_error::SessionError;

type SessionRow = (
    Uuid,
    String,
    Option<Uuid>,
    Option<Json<LastModel>>,
    Option<String>,
    DateTime<Utc>,
    DateTime<Utc>,
);

/// Session domain service over a SQLite pool holding the `sessions`
/// and `messages` tables. Clones share one connection pool.
///
/// Deletion removes a session together with its messages.
#[derive(Debug, Clone)]
pub struct SessionService {
    pub(super) db: SqlitePool,
}

impl SessionService {
    /// Creates the service over a SQLite pool.
    #[must_use]
    pub fn new(db: SqlitePool) -> Self {
        Self { db }
    }

    /// Lists every session, most recently updated first.
    ///
    /// # Errors
    ///
    /// [`SessionError::Store`] when the database fails.
    pub async fn list_sessions(&self) -> Result<Vec<Session>, SessionError> {
        let rows = sqlx::query_as::<_, SessionRow>(
            "SELECT id, title, leaf_id, last_model, directory, created_at, updated_at
             FROM sessions
             ORDER BY updated_at DESC, id DESC",
        )
        .fetch_all(&self.db)
        .await?;
        Ok(rows.into_iter().map(session_from_row).collect())
    }

    /// Creates an empty session, bound to `directory` when given; the
    /// session stores the directory's canonical path.
    ///
    /// # Errors
    ///
    /// [`SessionError::DirectoryNotFound`] when `directory` is not an
    /// absolute path to an existing directory, and
    /// [`SessionError::Store`] when the database fails.
    pub async fn create(&self, directory: Option<&Path>) -> Result<Session, SessionError> {
        let directory = match directory {
            Some(path) => Some(canonical_directory(path).await?),
            None => None,
        };
        let id = Uuid::new_v4();
        let now = Utc::now();
        sqlx::query(
            "INSERT INTO sessions (id, title, leaf_id, last_model, directory, created_at, updated_at)
             VALUES (?, '', NULL, NULL, ?, ?, ?)",
        )
        .bind(id)
        .bind(&directory)
        .bind(now)
        .bind(now)
        .execute(&self.db)
        .await?;
        Ok(Session {
            id,
            title: String::new(),
            leaf_id: None,
            last_model: None,
            directory,
            created_at: now,
            updated_at: now,
        })
    }

    /// Finds a session by id.
    ///
    /// # Errors
    ///
    /// [`SessionError::Store`] when the database fails.
    pub async fn find(&self, id: Uuid) -> Result<Option<Session>, SessionError> {
        let row = sqlx::query_as::<_, SessionRow>(
            "SELECT id, title, leaf_id, last_model, directory, created_at, updated_at
             FROM sessions
             WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.db)
        .await?;
        Ok(row.map(session_from_row))
    }

    /// Renames a session.
    ///
    /// # Errors
    ///
    /// [`SessionError::TitleRequired`] for a blank title,
    /// [`SessionError::NotFound`] when no such session exists, and
    /// [`SessionError::Store`] when the database fails.
    pub async fn rename(&self, id: Uuid, title: &str) -> Result<Session, SessionError> {
        let title = title.trim();
        if title.is_empty() {
            return Err(SessionError::TitleRequired);
        }
        let row = sqlx::query_as::<_, SessionRow>(
            "UPDATE sessions
             SET title = ?, updated_at = ?
             WHERE id = ?
             RETURNING id, title, leaf_id, last_model, directory, created_at, updated_at",
        )
        .bind(title)
        .bind(Utc::now())
        .bind(id)
        .fetch_optional(&self.db)
        .await?;
        row.map(session_from_row).ok_or(SessionError::NotFound)
    }

    /// Permanently deletes a session together with its messages.
    ///
    /// # Errors
    ///
    /// [`SessionError::NotFound`] when no such session exists and
    /// [`SessionError::Store`] when the database fails.
    pub async fn delete(&self, id: Uuid) -> Result<(), SessionError> {
        let result = sqlx::query("DELETE FROM sessions WHERE id = ?")
            .bind(id)
            .execute(&self.db)
            .await?;
        if result.rows_affected() == 0 {
            return Err(SessionError::NotFound);
        }
        Ok(())
    }

    /// Moves the active leaf of a session.
    ///
    /// # Errors
    ///
    /// [`SessionError::Store`] when the database fails.
    pub async fn update_leaf(&self, id: Uuid, leaf_id: Uuid) -> Result<(), SessionError> {
        sqlx::query("UPDATE sessions SET leaf_id = ?, updated_at = ? WHERE id = ?")
            .bind(leaf_id)
            .bind(Utc::now())
            .bind(id)
            .execute(&self.db)
            .await?;
        Ok(())
    }

    /// Records the model selection used by a turn on a session.
    ///
    /// # Errors
    ///
    /// [`SessionError::Store`] when the database fails.
    pub async fn update_last_model(
        &self,
        id: Uuid,
        last_model: LastModel,
    ) -> Result<(), SessionError> {
        sqlx::query("UPDATE sessions SET last_model = ?, updated_at = ? WHERE id = ?")
            .bind(Json(last_model))
            .bind(Utc::now())
            .bind(id)
            .execute(&self.db)
            .await?;
        Ok(())
    }
}

fn session_from_row(
    (id, title, leaf_id, last_model, directory, created_at, updated_at): SessionRow,
) -> Session {
    Session {
        id,
        title,
        leaf_id,
        last_model: last_model.map(|json| json.0),
        directory,
        created_at,
        updated_at,
    }
}

async fn canonical_directory(path: &Path) -> Result<String, SessionError> {
    let not_found = || SessionError::DirectoryNotFound(path.display().to_string());
    if !path.is_absolute() {
        return Err(not_found());
    }
    let canonical = fs::canonicalize(path).await.map_err(|_| not_found())?;
    let is_dir = fs::metadata(&canonical)
        .await
        .is_ok_and(|metadata| metadata.is_dir());
    if !is_dir {
        return Err(not_found());
    }
    dunce::simplified(&canonical)
        .to_str()
        .map(str::to_owned)
        .ok_or_else(not_found)
}
