//! Row types for the local tables, mapped with `sqlx::FromRow`.
//!
//! UUIDs and JSON payloads are stored as TEXT; timestamps are Unix
//! milliseconds in INTEGER columns.

#![allow(missing_docs)]

use sqlx::types::Json;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub role: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Setting {
    pub user_id: Uuid,
    pub key: String,
    pub value: Json<serde_json::Value>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Provider {
    pub id: Uuid,
    pub user_id: Uuid,
    pub kind: String,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub models: Json<Vec<String>>,
    pub api_path: String,
    pub models_path: String,
    pub enabled: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LastModel {
    pub provider_id: Uuid,
    pub model: String,
    pub thinking_effort: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Conversation {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub status: String,
    pub leaf_id: Option<Uuid>,
    pub last_model: Option<Json<LastModel>>,
    pub local_only: bool,
    pub archived_at: Option<i64>,
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
    pub role: String,
    pub content_json: Json<serde_json::Value>,
    pub client_msg_id: Option<String>,
    pub model: Option<String>,
    pub provider_id: Option<Uuid>,
    pub status: String,
    pub token_usage: Option<Json<TokenUsage>>,
    pub started_at: Option<i64>,
    pub first_token_at: Option<i64>,
    pub finished_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}
