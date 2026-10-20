use lemma_model::{Endpoint, ModelError, ProviderKind};
use serde::Deserialize;

use crate::error;
use crate::transport::HttpTransport;

#[derive(Deserialize)]
struct ModelsList {
    data: Vec<IdOnly>,
}

#[derive(Deserialize)]
struct IdOnly {
    id: String,
}

#[derive(Deserialize)]
struct GeminiModels {
    models: Vec<NameOnly>,
}

#[derive(Deserialize)]
struct NameOnly {
    name: String,
}

/// Lists the models an endpoint exposes, using the auth scheme of its
/// kind: bearer token for OpenAI-compatible APIs, `x-api-key` plus a
/// pinned `anthropic-version` for Anthropic, `x-goog-api-key` for Gemini.
///
/// An empty `models_path` selects the kind's default path. Gemini returns
/// names as `models/<id>`; the prefix is stripped.
pub(crate) async fn list_models(
    transport: &dyn HttpTransport,
    endpoint: Endpoint,
) -> Result<Vec<String>, ModelError> {
    let (default_base, default_path) = match endpoint.kind {
        ProviderKind::OpenAiCompatible => ("https://api.openai.com/v1", "/models"),
        ProviderKind::Anthropic => ("https://api.anthropic.com/v1", "/models"),
        ProviderKind::Gemini => (
            "https://generativelanguage.googleapis.com",
            "/v1beta/models",
        ),
    };
    let base = if endpoint.base_url.is_empty() {
        default_base
    } else {
        endpoint.base_url.trim_end_matches('/')
    };
    let path = if endpoint.models_path.is_empty() {
        default_path
    } else {
        &endpoint.models_path
    };
    let url = format!("{base}{path}");
    let key = endpoint.api_key;
    let mut headers = Vec::new();
    match endpoint.kind {
        ProviderKind::OpenAiCompatible if !key.is_empty() => {
            headers.push(("authorization".to_string(), format!("Bearer {key}")));
        }
        ProviderKind::Anthropic => {
            headers.push(("anthropic-version".to_string(), "2023-06-01".to_string()));
            if !key.is_empty() {
                headers.push(("x-api-key".to_string(), key));
            }
        }
        ProviderKind::Gemini if !key.is_empty() => {
            headers.push(("x-goog-api-key".to_string(), key));
        }
        _ => {}
    }
    let body = transport.get_json(url, headers).await?;
    let bad_body = |e: serde_json::Error| error::protocol(format!("bad model list: {e}"));
    match endpoint.kind {
        ProviderKind::Gemini => {
            let list: GeminiModels = serde_json::from_value(body).map_err(bad_body)?;
            Ok(list
                .models
                .into_iter()
                .map(|m| match m.name.strip_prefix("models/") {
                    Some(id) => id.to_string(),
                    None => m.name,
                })
                .collect())
        }
        ProviderKind::OpenAiCompatible | ProviderKind::Anthropic => {
            let list: ModelsList = serde_json::from_value(body).map_err(bad_body)?;
            Ok(list.data.into_iter().map(|m| m.id).collect())
        }
    }
}
