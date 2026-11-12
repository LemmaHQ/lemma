use lemma_model::ApiFormat;

/// Input for updating a custom provider. A `None` field keeps its current
/// value; `Some` replaces it, and an empty `api_key` clears the key.
#[derive(Debug, Default)]
pub struct UpdateCustomInput {
    /// Display name.
    pub name: Option<String>,
    /// API base URL.
    pub base_url: Option<String>,
    /// Plaintext replacement API key; empty clears the key.
    pub api_key: Option<String>,
    /// Generation endpoint path override.
    pub api_path: Option<String>,
    /// Model-list endpoint path override.
    pub models_path: Option<String>,
    /// Enabled flag.
    pub enabled: Option<bool>,
    /// Models and their features.
    pub models: Option<Vec<super::ProviderModel>>,
}

/// Input for updating a predefined provider's user-controlled fields.
#[derive(Debug, Default)]
pub struct UpdatePredefinedInput {
    /// Plaintext replacement API key; empty clears the key.
    pub api_key: Option<String>,
    /// Enabled flag.
    pub enabled: Option<bool>,
    /// Default API format for turns without a usable previous reply format.
    pub default_api_format: Option<ApiFormat>,
}
