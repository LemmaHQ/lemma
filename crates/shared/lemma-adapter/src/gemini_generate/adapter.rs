use lemma_core::StopReason;
use lemma_model::{Adapter, BoxEventStream, Endpoint, ModelError, ModelRequest};

use crate::http_transport::HttpTransport;
use crate::{request, sse};

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
        let base_url = if endpoint.base_url.is_empty() {
            "https://generativelanguage.googleapis.com"
        } else {
            endpoint.base_url.as_str()
        };
        let path = if endpoint.api_path.is_empty() {
            format!("/v1beta/models/{}:streamGenerateContent?alt=sse", req.model)
        } else {
            endpoint.api_path.replace("{model}", &req.model)
        };
        let url = format!("{}{}", base_url.trim_end_matches('/'), path);
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
        if let Some(effort) = req.thinking_effort.as_deref().filter(|e| !e.is_empty()) {
            body["generationConfig"]["thinkingConfig"]["thinkingBudget"] =
                serde_json::json!(request::thinking_budget(effort));
        }
        let headers = if endpoint.api_key.is_empty() {
            Vec::new()
        } else {
            vec![("x-goog-api-key".to_string(), endpoint.api_key.clone())]
        };
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
