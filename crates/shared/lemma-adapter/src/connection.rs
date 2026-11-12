use lemma_model::{ApiFormat, Endpoint};

pub(crate) fn base_url(endpoint: &Endpoint) -> &str {
    if !endpoint.base_url.is_empty() {
        return endpoint.base_url.trim_end_matches('/');
    }
    match endpoint.api_format {
        ApiFormat::OpenAiCompatible => "https://api.openai.com/v1",
        ApiFormat::Anthropic => "https://api.anthropic.com",
        ApiFormat::Gemini => "https://generativelanguage.googleapis.com",
    }
}

pub(crate) fn credential_headers(endpoint: &Endpoint) -> Vec<(String, String)> {
    let key = &endpoint.api_key;
    let mut headers = Vec::new();
    match endpoint.api_format {
        ApiFormat::OpenAiCompatible if !key.is_empty() => {
            headers.push(("authorization".to_string(), format!("Bearer {key}")));
        }
        ApiFormat::Anthropic => {
            headers.push(("anthropic-version".to_string(), "2023-06-01".to_string()));
            if !key.is_empty() {
                headers.push(("x-api-key".to_string(), key.clone()));
            }
        }
        ApiFormat::Gemini if !key.is_empty() => {
            headers.push(("x-goog-api-key".to_string(), key.clone()));
        }
        ApiFormat::OpenAiCompatible | ApiFormat::Gemini => {}
    }
    headers
}
