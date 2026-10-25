/// Input for updating a provider. A `None` field keeps its current value;
/// `Some` replaces it, and an empty `api_key` clears the key.
#[derive(Debug, Default)]
pub struct UpdateInput {
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
    /// Model ids to cache.
    pub models: Option<Vec<String>>,
}
