use lemma_model::ApiFormat;
use uuid::Uuid;

use super::ProviderModel;

/// A provider as presented to callers.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProviderView {
    /// Built-in provider configuration.
    Predefined(PredefinedProviderView),
    /// User-defined provider configuration.
    Custom(CustomProviderView),
}

/// A predefined provider's catalog data and user-controlled fields.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PredefinedProviderView {
    /// Provider id.
    pub id: Uuid,
    /// Catalog identifier.
    pub identifier: String,
    /// Display name supplied by the catalog.
    pub name: String,
    /// Formats the provider serves.
    pub api_formats: Vec<ApiFormat>,
    /// Default format for turns without a usable previous reply format.
    pub default_api_format: ApiFormat,
    /// Built-in models and their features.
    pub models: Vec<ProviderModel>,
    /// Plaintext API key; empty when unset.
    pub api_key: String,
    /// Enabled flag.
    pub enabled: bool,
}

/// A custom provider's complete user configuration.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CustomProviderView {
    /// Provider id.
    pub id: Uuid,
    /// User-facing machine identifier, ASCII-only, immutable after creation.
    pub identifier: String,
    /// Display name.
    pub name: String,
    /// API format, immutable after creation.
    pub api_format: ApiFormat,
    /// API base URL.
    pub base_url: String,
    /// Plaintext API key; empty when unset.
    pub api_key: String,
    /// Models and their features.
    pub models: Vec<ProviderModel>,
    /// Enabled flag.
    pub enabled: bool,
    /// Generation endpoint path override.
    pub api_path: String,
    /// Model-list endpoint path override.
    pub models_path: String,
}
