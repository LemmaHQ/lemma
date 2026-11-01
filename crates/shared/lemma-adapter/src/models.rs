use lemma_model::{Endpoint, ModelError, ProviderKind};
use serde::Deserialize;

use crate::connection;
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
/// An empty `models_path` selects the kind's default under the base URL
/// that generation uses: `/models` for OpenAI-compatible APIs,
/// `/v1/models` for Anthropic, `/v1beta/models` for Gemini. Gemini returns
/// names as `models/<id>`; the prefix is stripped.
pub(crate) async fn list_models<T: HttpTransport>(
    transport: &T,
    endpoint: Endpoint,
) -> Result<Vec<String>, ModelError> {
    let default_path = match endpoint.kind {
        ProviderKind::OpenAiCompatible => "/models",
        ProviderKind::Anthropic => "/v1/models",
        ProviderKind::Gemini => "/v1beta/models",
    };
    let path = if endpoint.models_path.is_empty() {
        default_path
    } else {
        &endpoint.models_path
    };
    let url = format!("{}{}", connection::base_url(&endpoint), path);
    let headers = connection::credential_headers(&endpoint);
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
