use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// Model ids cached on a provider, stored as a JSON array.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, FromJsonQueryResult)]
pub struct Models(pub Vec<String>);

/// A user-configured model provider.
#[sea_orm::model]
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "providers")]
pub struct Model {
    /// Provider id.
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    /// Owning user.
    pub user_id: Uuid,
    /// Stored kind string (`openai`, `anthropic`, `gemini`).
    pub kind: String,
    /// User-facing machine identifier, ASCII-only, immutable after creation.
    pub identifier: String,
    /// Display name.
    pub name: String,
    /// Normalized API base URL ending at host or path.
    pub base_url: String,
    /// API key sealed with lemma-crypto.
    pub api_key: String,
    /// Generation endpoint path override; empty means the adapter default.
    pub api_path: String,
    /// Model-list endpoint path override; empty means the adapter default.
    pub models_path: String,
    /// Cached model ids.
    pub models: Models,
    /// Whether the provider is selectable.
    pub enabled: bool,
    /// Creation time.
    pub created_at: DateTimeUtc,
}

impl ActiveModelBehavior for ActiveModel {}
