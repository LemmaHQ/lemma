/// API format of a provider, selecting the adapter that speaks it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApiFormat {
    /// OpenAI chat-completions and compatible APIs.
    OpenAiCompatible,
    /// Anthropic Messages API.
    Anthropic,
    /// Gemini generate-content API.
    Gemini,
}

impl ApiFormat {
    /// Wire string stored for this format: `"openai"`, `"anthropic"`, or `"gemini"`.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::OpenAiCompatible => "openai",
            Self::Anthropic => "anthropic",
            Self::Gemini => "gemini",
        }
    }

    /// Parses a stored format string, returning `None` when unknown.
    #[must_use]
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "openai" => Some(Self::OpenAiCompatible),
            "anthropic" => Some(Self::Anthropic),
            "gemini" => Some(Self::Gemini),
            _ => None,
        }
    }
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

#[cfg(test)]
mod tests {
    use super::ApiFormat;

    #[test]
    fn api_format_wire_encodings_round_trip() {
        for (format, expected) in [
            (ApiFormat::OpenAiCompatible, "openai"),
            (ApiFormat::Anthropic, "anthropic"),
            (ApiFormat::Gemini, "gemini"),
        ] {
            let wire = format.as_str();
            assert_eq!(wire, expected, "wire string for {format:?}");
            assert_eq!(
                ApiFormat::parse(wire),
                Some(format),
                "round-trip for {wire}"
            );
        }
        assert_eq!(ApiFormat::parse("bogus"), None, "unknown api format");
    }
}
