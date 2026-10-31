use lemma_model::{Endpoint, ProviderKind};

pub(crate) fn base_url(endpoint: &Endpoint) -> &str {
    if !endpoint.base_url.is_empty() {
        return endpoint.base_url.trim_end_matches('/');
    }
    match endpoint.kind {
        ProviderKind::OpenAiCompatible => "https://api.openai.com/v1",
        ProviderKind::Anthropic => "https://api.anthropic.com",
        ProviderKind::Gemini => "https://generativelanguage.googleapis.com",
    }
}

pub(crate) fn credential_headers(endpoint: &Endpoint) -> Vec<(String, String)> {
    let key = &endpoint.api_key;
    let mut headers = Vec::new();
    match endpoint.kind {
        ProviderKind::OpenAiCompatible if !key.is_empty() => {
            headers.push(("authorization".to_string(), format!("Bearer {key}")));
        }
        ProviderKind::Anthropic => {
            headers.push(("anthropic-version".to_string(), "2023-06-01".to_string()));
            if !key.is_empty() {
                headers.push(("x-api-key".to_string(), key.clone()));
            }
        }
        ProviderKind::Gemini if !key.is_empty() => {
            headers.push(("x-goog-api-key".to_string(), key.clone()));
        }
        ProviderKind::OpenAiCompatible | ProviderKind::Gemini => {}
    }
    headers
}
