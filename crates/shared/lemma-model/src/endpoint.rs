use sea_orm::entity::prelude::*;

/// API format of a provider, selecting the adapter that speaks it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "String", db_type = "String(StringLen::None)")]
pub enum ApiFormat {
    /// OpenAI chat-completions and compatible APIs.
    #[sea_orm(string_value = "openai")]
    OpenAiCompatible,
    /// Anthropic Messages API.
    #[sea_orm(string_value = "anthropic")]
    Anthropic,
    /// Gemini generate-content API.
    #[sea_orm(string_value = "gemini")]
    Gemini,
}

/// Connection details of one provider, with its API key in plaintext.
#[derive(Debug, Clone)]
pub struct Endpoint {
    /// API format.
    pub api_format: ApiFormat,
    /// Base URL in the form the vendor SDK takes: `https://api.openai.com/v1`,
    /// `https://api.anthropic.com`, `https://generativelanguage.googleapis.com`;
    /// empty selects the vendor default.
    pub base_url: String,
    /// Plaintext API key; empty sends no credentials.
    pub api_key: String,
    /// Generation path override; empty selects the format default.
    pub api_path: String,
    /// Model-list path override; empty selects the format default.
    pub models_path: String,
}
