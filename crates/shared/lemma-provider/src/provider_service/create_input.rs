use lemma_model::ApiFormat;

/// Input for creating a custom provider. `api_key` is plaintext.
#[derive(Debug)]
pub struct CreateCustomInput {
    /// API format, immutable after creation.
    pub api_format: ApiFormat,
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
    /// Models and their features.
    pub models: Vec<super::ProviderModel>,
}
