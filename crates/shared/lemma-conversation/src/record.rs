//! Domain types for conversations and their messages. Each backend maps
//! its own row representation onto these types.

use chrono::{DateTime, Utc};
use uuid::Uuid;

/// A conversation owned by a user.
#[derive(Debug, Clone)]
pub struct Conversation {
    /// Conversation id.
    pub id: Uuid,
    /// Owning user.
    pub user_id: Uuid,
    /// Display title.
    pub title: String,
    /// Lifecycle status: `active` or `archived`.
    pub status: String,
    /// Archive time, if archived.
    pub archived_at: Option<DateTime<Utc>>,
    /// Creation time.
    pub created_at: DateTime<Utc>,
    /// Last update time.
    pub updated_at: DateTime<Utc>,
}

/// A message in a conversation.
#[derive(Debug, Clone)]
pub struct Message {
    /// Message id.
    pub id: Uuid,
    /// Owning conversation.
    pub conversation_id: Uuid,
    /// Parent message in the conversation tree; `None` for roots.
    pub parent_id: Option<Uuid>,
    /// Authoring role.
    pub role: String,
    /// Structured content payload.
    pub content_json: serde_json::Value,
    /// Provider used, for assistant messages.
    pub provider_id: Option<Uuid>,
    /// Model used, for assistant messages.
    pub model: Option<String>,
    /// Delivery status: `streaming`, `done`, `aborted`, or `error`.
    pub status: String,
    /// Failure reason when status is `error`; `None` otherwise.
    pub error: Option<String>,
    /// Creation time.
    pub created_at: DateTime<Utc>,
    /// Last update time.
    pub updated_at: DateTime<Utc>,
}
