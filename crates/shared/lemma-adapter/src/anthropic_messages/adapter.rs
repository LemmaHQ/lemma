use lemma_core::StopReason;
use lemma_model::{Adapter, BoxEventStream, Endpoint, ModelError, ModelRequest};

use crate::http_transport::HttpTransport;
use crate::{request, sse};

use super::parser::{Block, Parser};

/// Required by the API; acts as a fixed response-length ceiling.
const MAX_TOKENS: u32 = 8192;
/// Pinned API version header.
const ANTHROPIC_VERSION: &str = "2023-06-01";

/// Streams via `POST <base_url>/messages`, or the endpoint's `api_path`
/// in place of the path, with an `x-api-key` header.
#[derive(Debug)]
pub struct AnthropicMessages<T> {
    transport: T,
    endpoint: Endpoint,
}

impl<T: HttpTransport> AnthropicMessages<T> {
    /// Creates the adapter for `endpoint` over `transport`.
    pub fn new(transport: T, endpoint: Endpoint) -> Self {
        Self {
            transport,
            endpoint,
        }
    }
}

impl<T: HttpTransport> Adapter for AnthropicMessages<T> {
    async fn stream(&self, req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        let endpoint = &self.endpoint;
        let base_url = if endpoint.base_url.is_empty() {
            "https://api.anthropic.com/v1"
        } else {
            endpoint.base_url.as_str()
        };
        let path = if endpoint.api_path.is_empty() {
            "/messages"
        } else {
            &endpoint.api_path
        };
        let url = format!("{}{}", base_url.trim_end_matches('/'), path);
        let effort = req.thinking_effort.as_deref().filter(|e| !e.is_empty());
        let budget = effort.map(request::thinking_budget);
        let max_tokens = match budget {
            Some(budget) => MAX_TOKENS.max(budget + 8192),
            None => MAX_TOKENS,
        };
        let mut body = serde_json::json!({
            "model": req.model,
            "max_tokens": max_tokens,
            "messages": request::anthropic_messages(&req.messages),
            "stream": true,
        });
        if !req.tools.is_empty() {
            body["tools"] = req
                .tools
                .iter()
                .map(|t| {
                    serde_json::json!({
                        "name": t.name,
                        "description": t.description,
                        "input_schema": t.parameters,
                    })
                })
                .collect();
        }
        if let Some(budget) = budget {
            body["thinking"] = serde_json::json!({
                "type": "enabled",
                "budget_tokens": budget,
            });
        }
        let mut headers = vec![(
            "anthropic-version".to_string(),
            ANTHROPIC_VERSION.to_string(),
        )];
        if !endpoint.api_key.is_empty() {
            headers.push(("x-api-key".to_string(), endpoint.api_key.clone()));
        }
        let bytes = self.transport.post_stream(url, headers, body).await?;
        Ok(sse::events_from_sse(
            bytes,
            Parser {
                input: None,
                output: None,
                stop: StopReason::Stop,
                block: Block::None,
                signature: String::new(),
            },
        ))
    }
}
