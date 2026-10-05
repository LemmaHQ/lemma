//! Record types shared by the provider domain and its storage backends.

use chrono::{DateTime, Utc};
use uuid::Uuid;

/// A provider row as the domain sees it. Each backend maps its own row
/// representation onto this type.
///
/// `api_key` is backend-dependent: sealed with lemma-crypto on the
/// server, plaintext in local storage.
#[derive(Debug, Clone)]
pub struct ProviderRecord {
    /// Provider id.
    pub id: Uuid,
    /// Owning user.
    pub user_id: Uuid,
    /// Stored kind string (`openai`, `anthropic`, `gemini`).
    pub kind: String,
    /// User-facing machine identifier, ASCII-only, immutable after creation.
    pub identifier: String,
    /// Display name.
    pub name: String,
    /// API base URL, without trailing slash.
    pub base_url: String,
    /// API key in the backend's storage encoding.
    pub api_key: String,
    /// Chat endpoint path override; empty means the adapter default.
    pub api_path: String,
    /// Model-list endpoint path override; empty means `/models`.
    pub models_path: String,
    /// Cached model ids.
    pub models: Vec<String>,
    /// Whether the provider is selectable.
    pub enabled: bool,
    /// Creation time.
    pub created_at: DateTime<Utc>,
    /// Last update time.
    pub updated_at: DateTime<Utc>,
}

/// Fields for inserting a provider. `api_key` is stored as given.
#[derive(Debug, Clone)]
pub struct NewProvider {
    /// Provider id.
    pub id: Uuid,
    /// Stored kind string.
    pub kind: String,
    /// User-facing machine identifier, ASCII-only, immutable after creation.
    pub identifier: String,
    /// Display name.
    pub name: String,
    /// API base URL.
    pub base_url: String,
    /// API key in the backend's storage encoding.
    pub api_key: String,
    /// Chat endpoint path override.
    pub api_path: String,
    /// Model-list endpoint path override.
    pub models_path: String,
    /// Cached model ids.
    pub models: Vec<String>,
}

/// Partial update: `None` fields are left untouched. `api_key` is stored
/// as given.
#[derive(Debug, Default)]
pub struct ProviderPatch {
    /// Display name.
    pub name: Option<String>,
    /// API base URL.
    pub base_url: Option<String>,
    /// API key in the backend's storage encoding.
    pub api_key: Option<String>,
    /// Chat endpoint path override.
    pub api_path: Option<String>,
    /// Model-list endpoint path override.
    pub models_path: Option<String>,
    /// Enabled flag.
    pub enabled: Option<bool>,
    /// Cached model ids.
    pub models: Option<Vec<String>>,
}
