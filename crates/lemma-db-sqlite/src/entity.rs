//! Row types for the local tables, mapped with `sqlx::FromRow`.
//!
//! UUIDs and JSON payloads are stored as TEXT; timestamps are Unix
//! milliseconds in INTEGER columns.

#![allow(missing_docs)]

use sqlx::types::Json;
use uuid::Uuid;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LastModel {
    pub provider_id: Uuid,
    pub model: String,
    pub thinking_effort: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Conversation {
    pub id: Uuid,
    pub title: String,
    pub leaf_id: Option<Uuid>,
    pub local_only: bool,
    pub last_model: Option<Json<LastModel>>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct TokenUsage {
    pub input: i64,
    pub output: i64,
    pub cache_read: Option<i64>,
    pub cache_write: Option<i64>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Message {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub content_json: Json<serde_json::Value>,
    pub status: String,
    pub model: Option<String>,
    pub provider_id: Option<Uuid>,
    pub token_usage: Option<Json<TokenUsage>>,
    pub started_at: i64,
    pub first_token_at: Option<i64>,
    pub finished_at: Option<i64>,
    pub created_at: i64,
}
