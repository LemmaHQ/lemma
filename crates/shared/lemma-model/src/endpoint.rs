use std::str::FromStr;

/// API dialect of a provider, selecting the adapter that speaks it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderKind {
    /// OpenAI chat-completions and compatible APIs.
    OpenAiCompatible,
    /// Anthropic Messages API.
    Anthropic,
    /// Google Gemini API.
    Gemini,
}

impl ProviderKind {
    /// Stored string form: `openai`, `anthropic`, or `gemini`.
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::OpenAiCompatible => "openai",
            Self::Anthropic => "anthropic",
            Self::Gemini => "gemini",
        }
    }
}

impl FromStr for ProviderKind {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "openai" => Ok(Self::OpenAiCompatible),
            "anthropic" => Ok(Self::Anthropic),
            "gemini" => Ok(Self::Gemini),
            _ => Err(()),
        }
    }
}

/// Connection details of one provider, with its API key in plaintext.
#[derive(Debug, Clone)]
pub struct Endpoint {
    /// API dialect.
    pub kind: ProviderKind,
    /// Base URL, e.g. `https://api.openai.com/v1`; empty selects the
    /// vendor default.
    pub base_url: String,
    /// Generation endpoint path override; empty selects the adapter default.
    pub api_path: String,
    /// Model-list endpoint path override; empty selects the adapter default.
    pub models_path: String,
    /// Plaintext API key; empty sends no credentials.
    pub api_key: String,
}
