use lemma_core::StopReason;
use lemma_model::{Adapter, BoxEventStream, Endpoint, ModelError, ModelRequest};

use crate::http_transport::HttpTransport;
use crate::{connection, request, sse};

use super::parser::Parser;

/// Streams via `POST <base_url>/chat/completions`, or the endpoint's
/// `api_path` in place of the path, with a bearer token.
#[derive(Debug)]
pub(crate) struct OpenAiCompatible<T> {
    transport: T,
    endpoint: Endpoint,
}

impl<T: HttpTransport> OpenAiCompatible<T> {
    pub(crate) fn new(transport: T, endpoint: Endpoint) -> Self {
        Self {
            transport,
            endpoint,
        }
    }
}

impl<T: HttpTransport> Adapter for OpenAiCompatible<T> {
    async fn stream(&self, req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        let endpoint = &self.endpoint;
        let path = if endpoint.api_path.is_empty() {
            "/chat/completions"
        } else {
            &endpoint.api_path
        };
        let url = format!("{}{}", connection::base_url(endpoint), path);
        let mut messages = request::openai_messages(&req.messages);
        if let Some(prompt) = req.system_prompt {
            messages.insert(
                0,
                serde_json::json!({ "role": "system", "content": prompt }),
            );
        }
        let mut body = serde_json::json!({
            "model": req.model,
            "messages": messages,
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
        let headers = connection::credential_headers(endpoint);
        let bytes = self.transport.post_stream(url, headers, body).await?;
        Ok(sse::events_from_sse(
            bytes,
            Parser {
                usage: None,
                stop: StopReason::Stop,
                tools: Vec::new(),
            },
        ))
    }
}
