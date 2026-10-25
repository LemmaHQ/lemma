use lemma_core::StopReason;
use lemma_model::{Adapter, BoxEventStream, Endpoint, ModelError, ModelRequest};

use crate::http_transport::HttpTransport;
use crate::{request, sse};

use super::parser::Parser;

/// Streams via `POST <base_url>/chat/completions`, or the endpoint's
/// `api_path` in place of the path, with a bearer token.
#[derive(Debug)]
pub struct OpenAiCompatible<T> {
    transport: T,
    endpoint: Endpoint,
}

impl<T: HttpTransport> OpenAiCompatible<T> {
    /// Creates the adapter for `endpoint` over `transport`.
    pub fn new(transport: T, endpoint: Endpoint) -> Self {
        Self {
            transport,
            endpoint,
        }
    }
}

impl<T: HttpTransport> Adapter for OpenAiCompatible<T> {
    async fn stream(&self, req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        let endpoint = &self.endpoint;
        let base_url = if endpoint.base_url.is_empty() {
            "https://api.openai.com/v1"
        } else {
            endpoint.base_url.as_str()
        };
        let path = if endpoint.api_path.is_empty() {
            "/chat/completions"
        } else {
            &endpoint.api_path
        };
        let url = format!("{}{}", base_url.trim_end_matches('/'), path);
        let mut body = serde_json::json!({
            "model": req.model,
            "messages": request::openai_messages(&req.messages),
            "stream": true,
            "stream_options": { "include_usage": true },
        });
        if !req.tools.is_empty() {
            body["tools"] = req
                .tools
                .iter()
                .map(|t| {
                    serde_json::json!({
                        "type": "function",
                        "function": {
                            "name": t.name,
                            "description": t.description,
                            "parameters": t.parameters,
                        },
                    })
                })
                .collect();
        }
        if let Some(effort) = req.thinking_effort.as_deref().filter(|e| !e.is_empty()) {
            body["reasoning_effort"] = serde_json::Value::String(effort.to_string());
        }
        let headers = if endpoint.api_key.is_empty() {
            Vec::new()
        } else {
            vec![(
                "authorization".to_string(),
                format!("Bearer {}", endpoint.api_key),
            )]
        };
        let bytes = self.transport.post_stream(url, headers, body).await?;
        Ok(sse::events_from_sse(
            bytes,
            Parser {
                usage: None,
                stop: StopReason::Stop,
                thinking_open: false,
                tools: Vec::new(),
            },
        ))
    }
}
