//! Row types for the shared tables, mapped with `sqlx::FromRow`.
//!
//! Field docs are limited to columns whose semantics are not obvious from
//! the name: sealed credentials and lifecycle pointers.

#![allow(missing_docs)]

use chrono::{DateTime, Utc};
use sqlx::types::Json;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub role: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Credential {
    pub user_id: Uuid,
    /// Argon2 hash of the account password.
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Setting {
    pub user_id: Uuid,
    pub key: String,
    pub value: Json<serde_json::Value>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct RefreshToken {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token_hash: String,
    pub label: Option<String>,
    pub replaced_by: Option<Uuid>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
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
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
    pub leaf_id: Option<Uuid>,
    pub status: String,
    pub last_model: Option<Json<LastModel>>,
    pub local_only: bool,
    pub archived_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
    pub error: Option<String>,
    pub token_usage: Option<Json<TokenUsage>>,
    pub started_at: Option<DateTime<Utc>>,
    pub first_token_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
