//! Adapter for OpenAI-compatible chat completions APIs.

use std::sync::Arc;

use lemma_trace::{StopReason, StreamEvent, Usage};
use serde::Deserialize;

use crate::error::ProviderError;
use crate::provider::{BoxChatFuture, Provider};
use crate::request::{ChatRequest, role_text};
use crate::sse::{SseParser, events_from_sse};
use crate::transport::{HttpTransport, ReqwestTransport};

/// Streams via `POST <base_url><api_path>/chat/completions` with a
/// bearer token.
pub struct OpenAiCompatible {
    transport: Arc<dyn HttpTransport>,
}

impl OpenAiCompatible {
    /// Creates the adapter with the default reqwest transport.
    pub fn new() -> Self {
        Self::with_transport(Arc::new(ReqwestTransport::new()))
    }

    /// Creates the adapter with an injected transport.
    pub fn with_transport(transport: Arc<dyn HttpTransport>) -> Self {
        Self { transport }
    }
}

impl Default for OpenAiCompatible {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Deserialize)]
struct StreamChunk {
    #[serde(default)]
    choices: Vec<StreamChoice>,
    usage: Option<RawUsage>,
}

#[derive(Deserialize)]
struct StreamChoice {
    delta: Option<StreamDelta>,
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct StreamDelta {
    content: Option<String>,
}

#[derive(Deserialize)]
struct RawUsage {
    prompt_tokens: i64,
    completion_tokens: i64,
}

fn map_finish_reason(reason: &str) -> StopReason {
    match reason {
        "length" => StopReason::Length,
        "tool_calls" => StopReason::ToolUse,
        _ => StopReason::Stop,
    }
}

// With stream_options.include_usage set, usage arrives in its own chunk
// ahead of [DONE]; the parser holds it until the terminal event.
struct Parser {
    usage: Option<RawUsage>,
    stop: StopReason,
}

impl SseParser for Parser {
    fn parse_line(&mut self, data: &str) -> Result<Vec<StreamEvent>, ProviderError> {
        if data == "[DONE]" {
            let usage = self.usage.take().map(|u| Usage {
                input: u.prompt_tokens,
                output: u.completion_tokens,
                cache_read: None,
                cache_write: None,
            });
            return Ok(vec![StreamEvent::Done {
                stop_reason: self.stop,
                usage,
            }]);
        }
        let chunk: StreamChunk = serde_json::from_str(data)
            .map_err(|e| ProviderError::protocol(format!("bad chunk: {e}")))?;
        if let Some(usage) = chunk.usage {
            self.usage = Some(usage);
            return Ok(Vec::new());
        }
        let choice = chunk.choices.into_iter().next();
        if let Some(reason) = choice.as_ref().and_then(|c| c.finish_reason.as_deref()) {
            self.stop = map_finish_reason(reason);
        }
        let content = choice
            .and_then(|c| c.delta)
            .and_then(|d| d.content)
            .filter(|t| !t.is_empty());
        Ok(match content {
            Some(text) => vec![StreamEvent::TextDelta { delta: text }],
            None => Vec::new(),
        })
    }

    fn on_eof(&mut self) -> Option<Usage> {
        self.usage.take().map(|u| Usage {
            input: u.prompt_tokens,
            output: u.completion_tokens,
            cache_read: None,
            cache_write: None,
        })
    }
}

impl Provider for OpenAiCompatible {
    fn stream(&self, req: ChatRequest) -> BoxChatFuture {
        let transport = Arc::clone(&self.transport);
        Box::pin(async move {
            let path = if req.api_path.is_empty() {
                "/chat/completions"
            } else {
                &req.api_path
            };
            let url = format!("{}{}", req.base_url.trim_end_matches('/'), path);
            let body = serde_json::json!({
                "model": req.model,
                "messages": req.messages.iter().filter_map(|m| role_text(m).map(|(role, text)| serde_json::json!({
                    "role": role,
                    "content": text,
                }))).collect::<Vec<_>>(),
                "stream": true,
                "stream_options": { "include_usage": true },
            });
            let bytes = transport
                .post_stream(
                    url,
                    vec![(
                        "authorization".to_string(),
                        format!("Bearer {}", req.api_key),
                    )],
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
        assert_eq!(map_finish_reason("stop"), StopReason::Stop);
        assert_eq!(map_finish_reason("length"), StopReason::Length);
        assert_eq!(map_finish_reason("tool_calls"), StopReason::ToolUse);
    }
}
