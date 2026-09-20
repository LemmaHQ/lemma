//! Adapter for the Gemini generateContent API.

use std::sync::Arc;

use lemma_trace::{StopReason, StreamEvent, Usage};
use serde::Deserialize;

use crate::error::ProviderError;
use crate::provider::{BoxChatFuture, Provider};
use crate::request::{ChatRequest, role_text};
use crate::sse::{SseParser, events_from_sse};
use crate::transport::{HttpTransport, ReqwestTransport};

/// Streams via `:streamGenerateContent?alt=sse` with an `x-goog-api-key`
/// header. The stream has no `[DONE]` sentinel; usage rides the last
/// chunk and is flushed at EOF.
pub struct GeminiGenerate {
    transport: Arc<dyn HttpTransport>,
}

impl GeminiGenerate {
    /// Creates the adapter with the default reqwest transport.
    pub fn new() -> Self {
        Self::with_transport(Arc::new(ReqwestTransport::new()))
    }

    /// Creates the adapter with an injected transport.
    pub fn with_transport(transport: Arc<dyn HttpTransport>) -> Self {
        Self { transport }
    }
}

impl Default for GeminiGenerate {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Deserialize)]
struct Chunk {
    #[serde(default)]
    candidates: Vec<Candidate>,
    #[serde(rename = "usageMetadata")]
    usage: Option<UsageMeta>,
}

#[derive(Deserialize)]
struct Candidate {
    content: Option<Content>,
    #[serde(rename = "finishReason")]
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct Content {
    #[serde(default)]
    parts: Vec<Part>,
}

#[derive(Deserialize)]
struct Part {
    text: Option<String>,
}

#[derive(Deserialize)]
struct UsageMeta {
    #[serde(rename = "promptTokenCount")]
    prompt: Option<i64>,
    #[serde(rename = "candidatesTokenCount")]
    completion: Option<i64>,
}

impl From<UsageMeta> for Usage {
    fn from(u: UsageMeta) -> Self {
        Self {
            input: u.prompt.unwrap_or(0),
            output: u.completion.unwrap_or(0),
            cache_read: None,
            cache_write: None,
        }
    }
}

fn map_finish_reason(reason: &str) -> StopReason {
    match reason {
        "MAX_TOKENS" => StopReason::Length,
        _ => StopReason::Stop,
    }
}

struct Parser {
    usage: Option<UsageMeta>,
    stop: StopReason,
}

impl SseParser for Parser {
    fn parse_line(&mut self, data: &str) -> Result<Vec<StreamEvent>, ProviderError> {
        let chunk: Chunk = serde_json::from_str(data)
            .map_err(|e| ProviderError::protocol(format!("bad chunk: {e}")))?;
        if let Some(u) = chunk.usage {
            self.usage = Some(u);
        }
        let candidate = chunk.candidates.into_iter().next();
        if let Some(reason) = candidate.as_ref().and_then(|c| c.finish_reason.as_deref()) {
            self.stop = map_finish_reason(reason);
        }
        let text: String = candidate
            .and_then(|c| c.content)
            .map(|c| c.parts.into_iter().filter_map(|p| p.text).collect())
            .unwrap_or_default();
        if text.is_empty() {
            Ok(Vec::new())
        } else {
            Ok(vec![StreamEvent::TextDelta { delta: text }])
        }
    }

    fn on_eof(&mut self) -> Option<Usage> {
        self.usage.take().map(Into::into)
    }

    fn on_stop_reason(&self) -> StopReason {
        self.stop
    }
}

impl Provider for GeminiGenerate {
    fn stream(&self, req: ChatRequest) -> BoxChatFuture {
        let transport = Arc::clone(&self.transport);
        Box::pin(async move {
            // A custom api_path embeds the model via a {model}
            // placeholder; the default path appends it directly.
            let path = if req.api_path.is_empty() {
                format!("/models/{}:streamGenerateContent?alt=sse", req.model)
            } else {
                req.api_path.replace("{model}", &req.model)
            };
            let url = format!("{}{}", req.base_url.trim_end_matches('/'), path);
            let body = serde_json::json!({
                // Gemini names the assistant role "model".
                "contents": req.messages.iter().filter_map(|m| role_text(m).map(|(role, text)| serde_json::json!({
                    "role": if role == "assistant" { "model" } else { "user" },
                    "parts": [{ "text": text }],
                }))).collect::<Vec<_>>(),
            });
            let bytes = transport
                .post_stream(
                    url,
                    vec![("x-goog-api-key".to_string(), req.api_key.clone())],
                    body,
                )
                .await?;
            Ok(events_from_sse(
                bytes,
                Parser {
                    usage: None,
                    stop: StopReason::Stop,
                },
            ))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_finish_reasons() {
        assert_eq!(map_finish_reason("STOP"), StopReason::Stop);
        assert_eq!(map_finish_reason("MAX_TOKENS"), StopReason::Length);
    }
}
