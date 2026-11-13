use lemma_model::ApiFormat;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// One model and the request features it supports.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, FromJsonQueryResult)]
pub struct ProviderModel {
    /// Model identifier sent upstream.
    pub id: String,
    /// Whether requests may carry tools and earlier tool calls.
    pub tool_calling: bool,
}

/// Models cached on a custom provider, stored as a JSON array.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, FromJsonQueryResult)]
pub struct Models(pub Vec<ProviderModel>);

/// Whether a provider's configuration ships with Lemma or belongs to the user.
#[derive(Clone, Copy, Debug, PartialEq, Eq, EnumIter, DeriveActiveEnum)]
#[sea_orm(
    rs_type = "String",
    db_type = "String(StringLen::None)",
    rename_all = "snake_case"
)]
pub enum ProviderSource {
    /// Built-in provider definition.
    Predefined,
    /// User-defined provider configuration.
    Custom,
}

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
    /// API format used by a custom provider or preferred for a predefined one.
    pub api_format: ApiFormat,
    /// Provider configuration category.
    pub source: ProviderSource,
    /// User-facing machine identifier, ASCII-only, immutable after creation.
    pub identifier: String,
    /// Display name for a custom provider.
    pub name: String,
    /// Normalized API base URL ending at host or path.
    pub base_url: String,
    /// API key sealed with lemma-crypto.
    pub api_key: String,
    /// Generation endpoint path override; empty means the adapter default.
    pub api_path: String,
    /// Model-list endpoint path override; empty means the adapter default.
    pub models_path: String,
    /// Cached custom models and their features.
    pub models: Models,
    /// Whether the provider is selectable.
    pub enabled: bool,
    /// Creation time.
    pub created_at: DateTimeUtc,
}

impl ActiveModelBehavior for ActiveModel {}
