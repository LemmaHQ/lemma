use lemma_core::StopReason;
use lemma_model::{Adapter, BoxEventStream, Endpoint, ModelError, ModelRequest};

use crate::http_transport::HttpTransport;
use crate::{connection, request, sse};

use super::parser::{Block, Parser};

const MAX_TOKENS: u32 = 8192;

#[derive(Debug)]
pub(crate) struct AnthropicMessages<T> {
    transport: T,
    endpoint: Endpoint,
}

impl<T: HttpTransport> AnthropicMessages<T> {
    pub(crate) fn new(transport: T, endpoint: Endpoint) -> Self {
        Self {
            transport,
            endpoint,
        }
    }
}

impl<T: HttpTransport> Adapter for AnthropicMessages<T> {
    async fn stream(&self, req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        let endpoint = &self.endpoint;
        let path = if endpoint.api_path.is_empty() {
            "/v1/messages"
        } else {
            &endpoint.api_path
        };
        let url = format!("{}{}", connection::base_url(endpoint), path);
        let mut body = serde_json::json!({
            "model": req.model,
            "max_tokens": MAX_TOKENS,
            "messages": request::anthropic_messages(&req.messages),
            "stream": true,
        });
        if let Some(prompt) = req.system_prompt {
            body["system"] = prompt.into();
        }
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
        let headers = connection::credential_headers(endpoint);
        let bytes = self.transport.post_stream(url, headers, body).await?;
        Ok(sse::events_from_sse(
            bytes,
            Parser {
                input: None,
                output: None,
                stop: StopReason::Stop,
                block: Block::None,
            },
        ))
    }
}
