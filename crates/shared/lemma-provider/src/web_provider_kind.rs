use crate::provider_error::ProviderError;
use crate::provider_service::WebFunction;

/// Built-in web search and fetch backend implementations.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum WebProviderKind {
    /// Built-in HTTP fetcher without search.
    Native,
    /// Exa search and fetch API.
    Exa,
    /// DeepSeek search and fetch API.
    DeepSeek,
}

/// Built-in web search backend implementations.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum WebSearchKind {
    /// Exa search API.
    Exa,
    /// DeepSeek search API.
    DeepSeek,
}

impl WebProviderKind {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Native => "native",
            Self::Exa => "exa",
            Self::DeepSeek => "deepseek",
        }
    }

    pub(crate) fn parse(raw: &str) -> Result<Self, ProviderError> {
        match raw {
            "native" => Ok(Self::Native),
            "exa" => Ok(Self::Exa),
            "deepseek" => Ok(Self::DeepSeek),
            other => Err(ProviderError::Store(format!(
                "unknown web provider kind: {other}"
            ))),
        }
    }

    pub(crate) fn name(self) -> &'static str {
        match self {
            Self::Native => "Native",
            Self::Exa => "Exa",
            Self::DeepSeek => "DeepSeek",
        }
    }

    pub(crate) fn base_url(self) -> &'static str {
        match self {
            Self::Native => "",
            Self::Exa => "https://api.exa.ai",
            Self::DeepSeek => "https://api.deepseek.com",
        }
    }

    pub(crate) fn supports(self, function: WebFunction) -> bool {
        match function {
            WebFunction::Search => self != Self::Native,
            WebFunction::Fetch => true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::WebProviderKind;

    #[test]
    fn kind_round_trips_and_rejects_unknown_values() {
        for kind in [
            WebProviderKind::Native,
            WebProviderKind::Exa,
            WebProviderKind::DeepSeek,
        ] {
            assert_eq!(
                WebProviderKind::parse(kind.as_str()).ok(),
                Some(kind),
                "web kind round-trip"
            );
        }
        assert!(
            WebProviderKind::parse("bogus").is_err(),
            "unknown web kind rejected"
        );
    }
}
