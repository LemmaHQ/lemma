//! Row types for the shared tables, mapped with `sqlx::FromRow`.
//!
//! Field docs focus on specialized columns requiring explicit context:
//! sealed credentials and lifecycle pointers.

#![allow(missing_docs)]

use chrono::{DateTime, Utc};
use lemma_conversation::LastModel;
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
pub struct RefreshToken {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token_hash: String,
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
    pub identifier: String,
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

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Conversation {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub leaf_id: Option<Uuid>,
    pub last_model: Option<Json<LastModel>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
