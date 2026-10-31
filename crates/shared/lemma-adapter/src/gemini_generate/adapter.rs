use lemma_core::StopReason;
use lemma_model::{Adapter, BoxEventStream, Endpoint, ModelError, ModelRequest};

use crate::http_transport::HttpTransport;
use crate::{connection, request, sse};

use super::parser::Parser;

/// Streams via `POST <base_url>/v1beta/models/{model}:streamGenerateContent?alt=sse`,
/// or the endpoint's `api_path` with `{model}` replaced, with an
/// `x-goog-api-key` header. Usage metrics accompany the terminal chunk and
/// flush at EOF.
#[derive(Debug)]
pub struct GeminiGenerate<T> {
    transport: T,
    endpoint: Endpoint,
}

impl<T: HttpTransport> GeminiGenerate<T> {
    /// Creates the adapter for `endpoint` over `transport`.
    pub fn new(transport: T, endpoint: Endpoint) -> Self {
        Self {
            transport,
            endpoint,
        }
    }
}

impl<T: HttpTransport> Adapter for GeminiGenerate<T> {
    async fn stream(&self, req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        let endpoint = &self.endpoint;
        let path = if endpoint.api_path.is_empty() {
            format!("/v1beta/models/{}:streamGenerateContent?alt=sse", req.model)
        } else {
            endpoint.api_path.replace("{model}", &req.model)
        };
        let url = format!("{}{}", connection::base_url(endpoint), path);
        let mut body = serde_json::json!({
            "contents": request::gemini_contents(&req.messages),
        });
        if !req.tools.is_empty() {
            body["tools"] = serde_json::json!([{
                "functionDeclarations": req.tools.iter().map(|t| serde_json::json!({
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters,
                })).collect::<Vec<_>>(),
            }]);
        }
        let headers = connection::credential_headers(endpoint);
        let bytes = self.transport.post_stream(url, headers, body).await?;
        Ok(sse::events_from_sse(
            bytes,
            Parser {
                usage: None,
                stop: StopReason::Stop,
                thinking_open: false,
                signature: None,
                next_call: 0,
                called_tool: false,
            },
        ))
    }
}
