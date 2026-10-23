use lemma_model::{Endpoint, ModelError, ProviderKind};
use serde::Deserialize;

use crate::error;
use crate::http_transport::HttpTransport;

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
/// An empty `models_path` selects `/models` under the base URL that
/// generation uses. Gemini returns names as `models/<id>`; the prefix is
/// stripped.
pub(crate) async fn list_models<T: HttpTransport>(
    transport: &T,
    endpoint: Endpoint,
) -> Result<Vec<String>, ModelError> {
    let default_base = match endpoint.kind {
        ProviderKind::OpenAiCompatible => "https://api.openai.com/v1",
        ProviderKind::Anthropic => "https://api.anthropic.com/v1",
        ProviderKind::Gemini => "https://generativelanguage.googleapis.com/v1beta",
    };
    let base = if endpoint.base_url.is_empty() {
        default_base
    } else {
        endpoint.base_url.trim_end_matches('/')
    };
    let path = if endpoint.models_path.is_empty() {
        "/models"
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

#[cfg(test)]
mod tests {
    use futures::executor;
    use std::sync::{Arc, Mutex};

    use super::*;
    use crate::http_transport::ByteStream;

    #[derive(Clone, Default)]
    struct RecordingTransport {
        urls: Arc<Mutex<Vec<String>>>,
    }

    impl HttpTransport for RecordingTransport {
        async fn post_stream(
            &self,
            _url: String,
            _headers: Vec<(String, String)>,
            _body: serde_json::Value,
        ) -> Result<ByteStream, ModelError> {
            Err(error::protocol("unused".to_string()))
        }

        async fn get_json(
            &self,
            url: String,
            _headers: Vec<(String, String)>,
        ) -> Result<serde_json::Value, ModelError> {
            if let Ok(mut urls) = self.urls.lock() {
                urls.push(url);
            }
            Ok(serde_json::json!({ "models": [{ "name": "models/gemini-x" }] }))
        }
    }

    #[test]
    fn gemini_lists_models_under_the_base_url_used_for_generation() -> Result<(), ModelError> {
        let transport = RecordingTransport::default();
        for base_url in ["", "https://generativelanguage.googleapis.com/v1beta/"] {
            let models = executor::block_on(list_models(
                &transport,
                Endpoint {
                    kind: ProviderKind::Gemini,
                    base_url: base_url.to_string(),
                    api_path: String::new(),
                    models_path: String::new(),
                    api_key: String::new(),
                },
            ))?;
            assert_eq!(models, ["gemini-x"]);
        }
        let urls = transport.urls.lock().map(|u| u.clone()).unwrap_or_default();
        assert_eq!(
            urls,
            [
                "https://generativelanguage.googleapis.com/v1beta/models",
                "https://generativelanguage.googleapis.com/v1beta/models",
            ]
        );
        Ok(())
    }
}
