//! Adapter for the Anthropic Messages API.

use std::sync::Arc;
use std::time::Instant;

use lemma_core::{StopReason, StreamEvent, ToolCall, Usage};
use serde::Deserialize;

use crate::error::ProviderError;
use crate::provider::{BoxChatFuture, Provider, timed};
use crate::request::{ChatRequest, anthropic_messages, thinking_budget};
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
    content_block: Option<ContentBlockStart>,
    usage: Option<RawUsage>,
    message: Option<MessageStart>,
    error: Option<ApiError>,
}

#[derive(Deserialize)]
struct Delta {
    #[serde(rename = "type")]
    kind: Option<String>,
    text: Option<String>,
    thinking: Option<String>,
    signature: Option<String>,
    partial_json: Option<String>,
    stop_reason: Option<String>,
}

#[derive(Deserialize)]
struct ContentBlockStart {
    #[serde(rename = "type")]
    kind: String,
    id: Option<String>,
    name: Option<String>,
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

struct Parser {
    input: Option<i64>,
    output: Option<i64>,
    stop: StopReason,
    block: Block,
    signature: String,
}

enum Block {
    None,
    Text,
    Thinking,
    Tool {
        id: String,
        name: String,
        args: String,
    },
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

    fn block_start(&mut self, block: ContentBlockStart) -> Vec<StreamEvent> {
        match block.kind.as_str() {
            "text" => {
                self.block = Block::Text;
                vec![StreamEvent::TextStart]
            }
            "thinking" => {
                self.block = Block::Thinking;
                self.signature.clear();
                vec![StreamEvent::ThinkingStart]
            }
            "tool_use" => {
                let id = block.id.unwrap_or_default();
                let name = block.name.unwrap_or_default();
                self.block = Block::Tool {
                    id: id.clone(),
                    name: name.clone(),
                    args: String::new(),
                };
                vec![StreamEvent::ToolCallStart { id, name }]
            }
            _ => Vec::new(),
        }
    }

    fn block_delta(&mut self, delta: Delta) -> Vec<StreamEvent> {
        match delta.kind.as_deref() {
            Some("text_delta") => match delta.text.filter(|t| !t.is_empty()) {
                Some(text) => vec![StreamEvent::TextDelta { delta: text }],
                None => Vec::new(),
            },
            Some("thinking_delta") => match delta.thinking.filter(|t| !t.is_empty()) {
                Some(thinking) => vec![StreamEvent::ThinkingDelta { delta: thinking }],
                None => Vec::new(),
            },
            Some("signature_delta") => {
                if let Some(signature) = delta.signature {
                    self.signature.push_str(&signature);
                }
                Vec::new()
            }
            Some("input_json_delta") => {
                let Some(fragment) = delta.partial_json.filter(|t| !t.is_empty()) else {
                    return Vec::new();
                };
                match &mut self.block {
                    Block::Tool { id, args, .. } => {
                        args.push_str(&fragment);
                        vec![StreamEvent::ToolCallDelta {
                            id: id.clone(),
                            delta: fragment,
                        }]
                    }
                    _ => Vec::new(),
                }
            }
            _ => Vec::new(),
        }
    }

    fn block_stop(&mut self) -> Vec<StreamEvent> {
        let block = std::mem::replace(&mut self.block, Block::None);
        match block {
            Block::Text => vec![StreamEvent::TextEnd],
            Block::Thinking => {
                let signature = if self.signature.is_empty() {
                    None
                } else {
                    Some(std::mem::take(&mut self.signature))
                };
                vec![StreamEvent::ThinkingEnd { signature }]
            }
            Block::Tool { id, name, args } => {
                let arguments =
                    serde_json::from_str(&args).unwrap_or(serde_json::Value::String(args));
                vec![StreamEvent::ToolCallEnd {
                    call: ToolCall {
                        id,
                        name,
                        arguments,
                    },
                }]
            }
            Block::None => Vec::new(),
        }
    }
}

impl SseParser for Parser {
    fn parse_line(&mut self, data: &str) -> Result<Vec<StreamEvent>, ProviderError> {
        let event: Event = serde_json::from_str(data)
            .map_err(|e| ProviderError::protocol(format!("bad event: {e}")))?;
        match event.kind.as_str() {
            "content_block_start" => Ok(match event.content_block {
                Some(block) => self.block_start(block),
                None => Vec::new(),
            }),
            "content_block_delta" => Ok(match event.delta {
                Some(delta) => self.block_delta(delta),
                None => Vec::new(),
            }),
            "content_block_stop" => Ok(self.block_stop()),
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
                ttft_ms: None,
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
            let base_url = if req.base_url.is_empty() {
                "https://api.anthropic.com/v1"
            } else {
                req.base_url.as_str()
            };
            let path = if req.api_path.is_empty() {
                "/messages"
            } else {
                &req.api_path
            };
            let url = format!("{}{}", base_url.trim_end_matches('/'), path);
            let effort = req.thinking_effort.as_deref().filter(|e| !e.is_empty());
            let budget = effort.map(thinking_budget);
            let max_tokens = match budget {
                Some(budget) => MAX_TOKENS.max(budget + 8192),
                None => MAX_TOKENS,
            };
            let mut body = serde_json::json!({
                "model": req.model,
                "max_tokens": max_tokens,
                "messages": anthropic_messages(&req.messages),
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
            if !req.api_key.is_empty() {
                headers.push(("x-api-key".to_string(), req.api_key.clone()));
            }
            let start = Instant::now();
            let bytes = transport
                .post_stream(
                    url,
                    headers,
                    body,
                )
                .await?;
            Ok(timed(
                start,
                events_from_sse(
                    bytes,
                    Parser {
                        input: None,
                        output: None,
                        stop: StopReason::Stop,
                        block: Block::None,
                        signature: String::new(),
                    },
                ),
            ))
        })
    }
}

#[cfg(test)]
mod tests {
    use futures::{StreamExt, stream};
    use lemma_core::ToolCall;

    use super::*;
    use crate::transport::ByteStream;

    fn parser() -> Parser {
        Parser {
            input: None,
            output: None,
            stop: StopReason::Stop,
            block: Block::None,
            signature: String::new(),
        }
    }

    async fn collect(sse: &str) -> Result<Vec<StreamEvent>, ProviderError> {
        let bytes: ByteStream = Box::pin(stream::iter(vec![Ok::<_, ProviderError>(
            sse.as_bytes().to_vec(),
        )]));
        events_from_sse(bytes, parser())
            .collect::<Vec<_>>()
            .await
            .into_iter()
            .collect()
    }

    #[test]
    fn thinking_text_and_tool_use_stream() -> Result<(), ProviderError> {
        let sse = "\
event: message_start\n\
data: {\"type\":\"message_start\",\"message\":{\"usage\":{\"input_tokens\":25,\"output_tokens\":1}}}\n\
event: content_block_start\n\
data: {\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"thinking\",\"thinking\":\"\"}}\n\
event: content_block_delta\n\
data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"thinking_delta\",\"thinking\":\"让我想想\"}}\n\
event: content_block_delta\n\
data: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"signature_delta\",\"signature\":\"sig_abc\"}}\n\
event: content_block_stop\n\
data: {\"type\":\"content_block_stop\",\"index\":0}\n\
event: content_block_start\n\
data: {\"type\":\"content_block_start\",\"index\":1,\"content_block\":{\"type\":\"text\",\"text\":\"\"}}\n\
event: content_block_delta\n\
data: {\"type\":\"content_block_delta\",\"index\":1,\"delta\":{\"type\":\"text_delta\",\"text\":\"答案\"}}\n\
event: content_block_stop\n\
data: {\"type\":\"content_block_stop\",\"index\":1}\n\
event: content_block_start\n\
data: {\"type\":\"content_block_start\",\"index\":2,\"content_block\":{\"type\":\"tool_use\",\"id\":\"toolu_1\",\"name\":\"get_weather\"}}\n\
event: content_block_delta\n\
data: {\"type\":\"content_block_delta\",\"index\":2,\"delta\":{\"type\":\"input_json_delta\",\"partial_json\":\"{\\\"city\\\": \\\"北京\\\"}\"}}\n\
event: content_block_stop\n\
data: {\"type\":\"content_block_stop\",\"index\":2}\n\
event: message_delta\n\
data: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"tool_use\"},\"usage\":{\"output_tokens\":40}}\n\
event: message_stop\n\
data: {\"type\":\"message_stop\"}\n";
        let events = futures::executor::block_on(collect(sse))?;
        assert_eq!(
            events,
            vec![
                StreamEvent::Start,
                StreamEvent::ThinkingStart,
                StreamEvent::ThinkingDelta {
                    delta: "让我想想".into(),
                },
                StreamEvent::ThinkingEnd {
                    signature: Some("sig_abc".into()),
                },
                StreamEvent::TextStart,
                StreamEvent::TextDelta {
                    delta: "答案".into()
                },
                StreamEvent::TextEnd,
                StreamEvent::ToolCallStart {
                    id: "toolu_1".into(),
                    name: "get_weather".into(),
                },
                StreamEvent::ToolCallDelta {
                    id: "toolu_1".into(),
                    delta: "{\"city\": \"北京\"}".into(),
                },
                StreamEvent::ToolCallEnd {
                    call: ToolCall {
                        id: "toolu_1".into(),
                        name: "get_weather".into(),
                        arguments: serde_json::json!({"city": "北京"}),
                    },
                },
                StreamEvent::Done {
                    stop_reason: StopReason::ToolUse,
                    usage: Some(Usage {
                        input: 25,
                        output: 40,
                        cache_read: None,
                        cache_write: None,
                    }),
                    ttft_ms: None,
                },
            ]
        );
        Ok(())
    }
}
