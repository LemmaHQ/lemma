//! Provider protocol families.

use std::str::FromStr;

/// Vendor family selecting the API dialect of a provider.
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
