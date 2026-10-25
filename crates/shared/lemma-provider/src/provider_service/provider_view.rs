use chrono::{DateTime, Utc};
use lemma_model::ProviderKind;
use uuid::Uuid;

/// A provider as presented to callers: the API key is opened to plaintext.
#[derive(Debug, Clone)]
pub struct ProviderView {
    /// Provider id.
    pub id: Uuid,
    /// Provider kind.
    pub kind: ProviderKind,
    /// User-facing machine identifier, ASCII-only, immutable after creation.
    pub identifier: String,
    /// Display name.
    pub name: String,
    /// API base URL.
    pub base_url: String,
    /// Plaintext API key; empty when none is stored or the stored one
    /// cannot be opened.
    pub api_key: String,
    /// Cached model ids.
    pub models: Vec<String>,
    /// Enabled flag.
    pub enabled: bool,
    /// Generation endpoint path override.
    pub api_path: String,
    /// Model-list endpoint path override.
    pub models_path: String,
    /// Creation time.
    pub created_at: DateTime<Utc>,
    /// Last update time.
    pub updated_at: DateTime<Utc>,
}
