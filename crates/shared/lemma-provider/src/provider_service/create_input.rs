use lemma_model::ProviderKind;

/// Input for creating a provider. `api_key` is plaintext.
#[derive(Debug)]
pub struct CreateInput {
    /// Provider kind.
    pub kind: ProviderKind,
    /// User-facing machine identifier, ASCII-only, immutable after creation.
    pub identifier: String,
    /// Display name.
    pub name: String,
    /// API base URL.
    pub base_url: String,
    /// Plaintext API key.
    pub api_key: String,
    /// Generation endpoint path override.
    pub api_path: String,
    /// Model-list endpoint path override.
    pub models_path: String,
    /// Model ids to cache.
    pub models: Vec<String>,
}
