use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// One session's persisted metadata.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Session {
    /// Session id.
    pub id: Uuid,
    /// Display title; empty until named.
    pub title: String,
    /// Active leaf message id in the tree.
    pub leaf_id: Option<Uuid>,
    /// Most recent provider and model used on this session.
    pub last_model: Option<LastModel>,
    /// Canonical workspace directory path, when bound.
    pub directory: Option<String>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last modification timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Provider and model selection recorded for a session's latest turn.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LastModel {
    /// Provider id.
    pub provider_id: Uuid,
    /// Model id.
    pub model: String,
}
