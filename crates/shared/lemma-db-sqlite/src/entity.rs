//! Row types for the local tables, mapped with `sqlx::FromRow`.
//!
//! UUIDs and JSON payloads are stored as TEXT; timestamps are Unix
//! milliseconds in INTEGER columns.

#![allow(missing_docs)]

use lemma_conversation::LastModel;
use sqlx::types::Json;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Conversation {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub leaf_id: Option<Uuid>,
    pub last_model: Option<Json<LastModel>>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Message {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub role: String,
    pub content_json: Json<serde_json::Value>,
    pub model: Option<String>,
    pub provider_id: Option<Uuid>,
    pub status: String,
    pub error: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// One page of message rows, newest first.
#[derive(Debug, Clone)]
pub struct MessagePage {
    pub messages: Vec<Message>,
    /// Whether older rows follow this page.
    pub has_more: bool,
}
