//! Adapter for the Gemini generateContent API.

use std::sync::Arc;
use std::time::Instant;

use lemma_core::{StopReason, StreamEvent, ToolCall, Usage};
use serde::Deserialize;

use crate::error::ProviderError;
use crate::provider::{BoxChatFuture, Provider, timed};
use crate::request::{ChatRequest, gemini_contents, thinking_budget};
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
    #[serde(default)]
    thought: bool,
    #[serde(rename = "thoughtSignature")]
    thought_signature: Option<String>,
    #[serde(rename = "functionCall")]
    function_call: Option<FunctionCall>,
}

#[derive(Deserialize)]
struct FunctionCall {
    name: String,
    #[serde(default)]
    args: serde_json::Value,
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
    thinking_open: bool,
    signature: Option<String>,
    next_call: u64,
    called_tool: bool,
}

impl Parser {
    fn close_thinking(&mut self, events: &mut Vec<StreamEvent>) {
        if self.thinking_open {
            self.thinking_open = false;
            events.push(StreamEvent::ThinkingEnd {
                signature: self.signature.take(),
            });
        }
    }

    fn part_events(&mut self, part: Part, events: &mut Vec<StreamEvent>) {
        if let Some(signature) = part.thought_signature {
            self.signature = Some(signature);
        }
        if part.thought {
            if let Some(text) = part.text.filter(|t| !t.is_empty()) {
                if !self.thinking_open {
                    self.thinking_open = true;
                    events.push(StreamEvent::ThinkingStart);
                }
                events.push(StreamEvent::ThinkingDelta { delta: text });
            }
            return;
        }
        if let Some(call) = part.function_call {
            self.close_thinking(events);
            self.called_tool = true;
            let id = format!("call_{}", self.next_call);
            self.next_call += 1;
            events.push(StreamEvent::ToolCallStart {
                id: id.clone(),
                name: call.name.clone(),
            });
            events.push(StreamEvent::ToolCallEnd {
                call: ToolCall {
                    id,
                    name: call.name,
                    arguments: call.args,
                },
            });
            return;
        }
        if let Some(text) = part.text.filter(|t| !t.is_empty()) {
            self.close_thinking(events);
            events.push(StreamEvent::TextDelta { delta: text });
        }
    }
}

impl SseParser for Parser {
    fn parse_line(&mut self, data: &str) -> Result<Vec<StreamEvent>, ProviderError> {
        let chunk: Chunk = serde_json::from_str(data)
            .map_err(|e| ProviderError::protocol(format!("bad chunk: {e}")))?;
        if let Some(u) = chunk.usage {
            self.usage = Some(u);
        }
        let candidate = chunk.candidates.into_iter().next();
        let finish = candidate
            .as_ref()
            .and_then(|c| c.finish_reason.as_deref())
            .map(str::to_string);
        let parts = candidate
            .and_then(|c| c.content)
            .map(|c| c.parts)
            .unwrap_or_default();
        let mut events = Vec::new();
        for part in parts {
            self.part_events(part, &mut events);
        }
        if let Some(reason) = finish.as_deref() {
            self.stop = if self.called_tool {
                StopReason::ToolUse
            } else {
                map_finish_reason(reason)
            };
        }
        Ok(events)
    }

    fn on_eof(&mut self) -> Option<Usage> {
        self.usage.take().map(Into::into)
    }

    fn flush(&mut self) -> Vec<StreamEvent> {
        let mut events = Vec::new();
        self.close_thinking(&mut events);
        events
    }

    fn on_stop_reason(&self) -> StopReason {
        self.stop
    }
}

impl Provider for GeminiGenerate {
    fn stream(&self, req: ChatRequest) -> BoxChatFuture {
        let transport = Arc::clone(&self.transport);
        Box::pin(async move {
            let base_url = if req.base_url.is_empty() {
                "https://generativelanguage.googleapis.com/v1beta"
            } else {
                req.base_url.as_str()
            };
            let path = if req.api_path.is_empty() {
                format!("/models/{}:streamGenerateContent?alt=sse", req.model)
            } else {
                req.api_path.replace("{model}", &req.model)
            };
            let url = format!("{}{}", base_url.trim_end_matches('/'), path);
            let mut body = serde_json::json!({
                "contents": gemini_contents(&req.messages),
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
                    serde_json::json!(thinking_budget(effort));
            }
            let headers = if req.api_key.is_empty() {
                Vec::new()
            } else {
                vec![("x-goog-api-key".to_string(), req.api_key.clone())]
            };
            let start = Instant::now();
            let bytes = transport.post_stream(url, headers, body).await?;
            Ok(timed(
                start,
                events_from_sse(
                    bytes,
                    Parser {
                        usage: None,
                        stop: StopReason::Stop,
                        thinking_open: false,
                        signature: None,
                        next_call: 0,
                        called_tool: false,
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
            usage: None,
            stop: StopReason::Stop,
            thinking_open: false,
            signature: None,
            next_call: 0,
            called_tool: false,
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
    fn thought_text_and_function_call_stream() -> Result<(), ProviderError> {
        let sse = "\
data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"想想\",\"thought\":true}]}}]}\n\
data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"一下\",\"thought\":true,\"thoughtSignature\":\"sig_xyz\"}]}}]}\n\
data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"答案\"}]}}]}\n\
data: {\"candidates\":[{\"content\":{\"parts\":[{\"functionCall\":{\"name\":\"get_weather\",\"args\":{\"city\":\"北京\"}}}]},\"finishReason\":\"STOP\"}],\"usageMetadata\":{\"promptTokenCount\":5,\"candidatesTokenCount\":10}}\n";
        let events = futures::executor::block_on(collect(sse))?;
        assert_eq!(
            events,
            vec![
                StreamEvent::Start,
                StreamEvent::ThinkingStart,
                StreamEvent::ThinkingDelta {
                    delta: "想想".into()
                },
                StreamEvent::ThinkingDelta {
                    delta: "一下".into()
                },
                StreamEvent::ThinkingEnd {
                    signature: Some("sig_xyz".into()),
                },
                StreamEvent::TextStart,
                StreamEvent::TextDelta {
                    delta: "答案".into()
                },
                StreamEvent::TextEnd,
                StreamEvent::ToolCallStart {
                    id: "call_0".into(),
                    name: "get_weather".into(),
                },
                StreamEvent::ToolCallEnd {
                    call: ToolCall {
                        id: "call_0".into(),
                        name: "get_weather".into(),
                        arguments: serde_json::json!({"city": "北京"}),
                    },
                },
                StreamEvent::Done {
                    stop_reason: StopReason::ToolUse,
                    usage: Some(Usage {
                        input: 5,
                        output: 10,
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
