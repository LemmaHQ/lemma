//! Fetches the live model list from a provider's API.

use std::time::Duration;

use crate::kind::ProviderKind;

#[derive(serde::Deserialize)]
struct ModelsList {
    data: Vec<IdOnly>,
}

#[derive(serde::Deserialize)]
struct IdOnly {
    id: String,
}

#[derive(serde::Deserialize)]
struct GeminiModels {
    models: Vec<NameOnly>,
}

#[derive(serde::Deserialize)]
struct NameOnly {
    name: String,
}

/// Lists the models a provider exposes, using the auth scheme of its
/// kind: bearer token for OpenAI-compatible APIs, `x-api-key` plus a
/// pinned `anthropic-version` for Anthropic, `x-goog-api-key` for Gemini.
///
/// An empty `models_path` defaults to `/models`. Gemini returns names as
/// `models/<id>`; the prefix is stripped.
pub async fn fetch_models(
    kind: ProviderKind,
    base_url: &str,
    api_key: &str,
    models_path: &str,
) -> Result<Vec<String>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;
    let (default_base, default_path) = match kind {
        ProviderKind::OpenAiCompatible => ("https://api.openai.com/v1", "/models"),
        ProviderKind::Anthropic => ("https://api.anthropic.com/v1", "/models"),
        ProviderKind::Gemini => ("https://generativelanguage.googleapis.com", "/v1beta/models"),
    };
    let base = if base_url.is_empty() {
        default_base
    } else {
        base_url.trim_end_matches('/')
    };
    let path = if models_path.is_empty() {
        default_path
    } else {
        models_path
    };
    let url = format!("{base}{path}");

    match kind {
        ProviderKind::OpenAiCompatible => {
            let mut req = client.get(&url);
            if !api_key.is_empty() {
                req = req.bearer_auth(api_key);
            }
            let list: ModelsList = req
                .send()
                .await
                .map_err(|e| e.to_string())?
                .error_for_status()
                .map_err(|e| e.to_string())?
                .json()
                .await
                .map_err(|e| e.to_string())?;
            Ok(list.data.into_iter().map(|m| m.id).collect())
        }
        ProviderKind::Anthropic => {
            let mut req = client
                .get(&url)
                .header("anthropic-version", "2023-06-01");
            if !api_key.is_empty() {
                req = req.header("x-api-key", api_key);
            }
            let list: ModelsList = req
                .send()
                .await
                .map_err(|e| e.to_string())?
                .error_for_status()
                .map_err(|e| e.to_string())?
                .json()
                .await
                .map_err(|e| e.to_string())?;
            Ok(list.data.into_iter().map(|m| m.id).collect())
        }
        ProviderKind::Gemini => {
            let mut req = client.get(&url);
            if !api_key.is_empty() {
                req = req.header("x-goog-api-key", api_key);
            }
            let list: GeminiModels = req
                .send()
                .await
                .map_err(|e| e.to_string())?
                .error_for_status()
                .map_err(|e| e.to_string())?
                .json()
                .await
                .map_err(|e| e.to_string())?;
            Ok(list
                .models
                .into_iter()
                .map(|m| {
                    m.name
                        .strip_prefix("models/")
                        .unwrap_or(&m.name)
                        .to_string()
                })
                .collect())
        }
    }
}
