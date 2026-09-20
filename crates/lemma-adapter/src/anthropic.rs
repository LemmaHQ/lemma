//! Adapter for the Anthropic Messages API.

use std::sync::Arc;

use lemma_trace::{StopReason, StreamEvent, Usage};
use serde::Deserialize;

use crate::error::ProviderError;
use crate::provider::{BoxChatFuture, Provider};
use crate::request::{ChatRequest, role_text};
use crate::sse::{SseParser, events_from_sse};
use crate::transport::{HttpTransport, ReqwestTransport};

/// Required by the API; acts as a fixed response-length ceiling.
const MAX_TOKENS: u32 = 8192;
/// Pinned API version header.
const ANTHROPIC_VERSION: &str = "2023-06-01";

/// Streams via `POST <base_url><api_path>/messages` with an `x-api-key`
/// header.
pub struct AnthropicMessages {
    transport: Arc<dyn HttpTransport>,
}

impl AnthropicMessages {
    /// Creates the adapter with the default reqwest transport.
    pub fn new() -> Self {
        Self::with_transport(Arc::new(ReqwestTransport::new()))
    }

    /// Creates the adapter with an injected transport.
    pub fn with_transport(transport: Arc<dyn HttpTransport>) -> Self {
        Self { transport }
    }
}

impl Default for AnthropicMessages {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Deserialize)]
struct Event {
    #[serde(rename = "type")]
    kind: String,
    delta: Option<Delta>,
    usage: Option<RawUsage>,
    message: Option<MessageStart>,
    error: Option<ApiError>,
}

#[derive(Deserialize)]
struct Delta {
    text: Option<String>,
    stop_reason: Option<String>,
}

#[derive(Deserialize)]
struct RawUsage {
    input_tokens: Option<i64>,
    output_tokens: Option<i64>,
}

#[derive(Deserialize)]
struct MessageStart {
    usage: Option<RawUsage>,
}

#[derive(Deserialize)]
struct ApiError {
    message: String,
}

fn map_stop_reason(reason: &str) -> StopReason {
    match reason {
        "max_tokens" => StopReason::Length,
        "tool_use" => StopReason::ToolUse,
        _ => StopReason::Stop,
    }
}

// Usage arrives split across events: input tokens in message_start,
// output tokens cumulative in message_delta.
struct Parser {
    input: Option<i64>,
    output: Option<i64>,
    stop: StopReason,
}

impl Parser {
    fn usage(&self) -> Option<Usage> {
        if self.input.is_none() && self.output.is_none() {
            return None;
        }
        Some(Usage {
            input: self.input.unwrap_or(0),
            output: self.output.unwrap_or(0),
            cache_read: None,
            cache_write: None,
        })
    }

    fn merge(&mut self, u: &RawUsage) {
        if let Some(i) = u.input_tokens {
            self.input = Some(i);
        }
        if let Some(o) = u.output_tokens {
            self.output = Some(o);
        }
    }
}

impl SseParser for Parser {
    fn parse_line(&mut self, data: &str) -> Result<Vec<StreamEvent>, ProviderError> {
        let event: Event = serde_json::from_str(data)
            .map_err(|e| ProviderError::protocol(format!("bad event: {e}")))?;
        match event.kind.as_str() {
            "content_block_delta" => {
                let text = event.delta.and_then(|d| d.text).filter(|t| !t.is_empty());
                Ok(match text {
                    Some(text) => vec![StreamEvent::TextDelta { delta: text }],
                    None => Vec::new(),
                })
            }
            "message_start" => {
                if let Some(u) = event.message.and_then(|m| m.usage) {
                    self.merge(&u);
                }
                Ok(Vec::new())
            }
            "message_delta" => {
                if let Some(reason) = event.delta.as_ref().and_then(|d| d.stop_reason.as_deref()) {
                    self.stop = map_stop_reason(reason);
                }
                if let Some(u) = event.usage {
                    self.merge(&u);
                }
                Ok(Vec::new())
            }
            "message_stop" => Ok(vec![StreamEvent::Done {
                stop_reason: self.stop,
                usage: self.usage(),
            }]),
            "error" => Err(ProviderError::protocol(format!(
                "anthropic error: {}",
                event.error.map(|e| e.message).unwrap_or_default()
            ))),
            _ => Ok(Vec::new()),
        }
    }

    fn on_eof(&mut self) -> Option<Usage> {
        self.usage()
    }
}

impl Provider for AnthropicMessages {
    fn stream(&self, req: ChatRequest) -> BoxChatFuture {
        let transport = Arc::clone(&self.transport);
        Box::pin(async move {
            let path = if req.api_path.is_empty() {
                "/messages"
            } else {
                &req.api_path
            };
            let url = format!("{}{}", req.base_url.trim_end_matches('/'), path);
            let body = serde_json::json!({
                "model": req.model,
                "max_tokens": MAX_TOKENS,
                "messages": req.messages.iter().filter_map(|m| role_text(m).map(|(role, text)| serde_json::json!({
                    "role": role,
                    "content": text,
                }))).collect::<Vec<_>>(),
                "stream": true,
            });
            let bytes = transport
                .post_stream(
                    url,
                    vec![
                        ("x-api-key".to_string(), req.api_key.clone()),
                        (
                            "anthropic-version".to_string(),
                            ANTHROPIC_VERSION.to_string(),
                        ),
                    ],
                    body,
                )
                .await?;
            Ok(events_from_sse(
                bytes,
                Parser {
                    input: None,
                    output: None,
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
    fn maps_stop_reasons() {
        assert_eq!(map_stop_reason("end_turn"), StopReason::Stop);
        assert_eq!(map_stop_reason("max_tokens"), StopReason::Length);
        assert_eq!(map_stop_reason("tool_use"), StopReason::ToolUse);
    }
}
