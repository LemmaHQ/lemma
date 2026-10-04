//! Adapter for OpenAI-compatible chat completions APIs.

use std::sync::Arc;
use std::time::Instant;

use lemma_core::{StopReason, StreamEvent, ToolCall, Usage};
use serde::Deserialize;

use crate::error::ProviderError;
use crate::provider::{BoxChatFuture, Provider, timed};
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
    reasoning_content: Option<String>,
    reasoning: Option<String>,
    #[serde(default)]
    tool_calls: Vec<RawToolCall>,
}

#[derive(Deserialize)]
struct RawToolCall {
    index: Option<usize>,
    id: Option<String>,
    function: Option<RawFunction>,
}

#[derive(Deserialize)]
struct RawFunction {
    name: Option<String>,
    arguments: Option<String>,
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
    thinking_open: bool,
    tools: Vec<ToolAcc>,
}

#[derive(Default)]
struct ToolAcc {
    id: String,
    name: String,
    args: String,
    started: bool,
    ended: bool,
}

impl Parser {
    fn usage(&mut self) -> Option<Usage> {
        self.usage.take().map(|u| Usage {
            input: u.prompt_tokens,
            output: u.completion_tokens,
            cache_read: None,
            cache_write: None,
        })
    }

    fn close_thinking(&mut self, events: &mut Vec<StreamEvent>) {
        if self.thinking_open {
            self.thinking_open = false;
            events.push(StreamEvent::ThinkingEnd { signature: None });
        }
    }

    fn end_tool(acc: &mut ToolAcc) -> StreamEvent {
        acc.ended = true;
        let arguments = serde_json::from_str(&acc.args)
            .unwrap_or_else(|_| serde_json::Value::String(acc.args.clone()));
        StreamEvent::ToolCallEnd {
            call: ToolCall {
                id: acc.id.clone(),
                name: acc.name.clone(),
                arguments,
            },
        }
    }

    fn end_pending_tools(&mut self, events: &mut Vec<StreamEvent>) {
        for acc in &mut self.tools {
            if acc.started && !acc.ended {
                events.push(Self::end_tool(acc));
            }
        }
    }

    fn tool_events(&mut self, calls: Vec<RawToolCall>, events: &mut Vec<StreamEvent>) {
        for call in calls {
            let index = call.index.unwrap_or(0);
            if self.tools.len() <= index {
                self.tools.resize_with(index + 1, ToolAcc::default);
            }
            if let Some(id) = call.id {
                self.tools[index].id = id;
            }
            let fragment = match call.function {
                Some(f) => {
                    if let Some(name) = f.name {
                        self.tools[index].name = name;
                    }
                    f.arguments.filter(|a| !a.is_empty())
                }
                None => None,
            };
            let acc = &mut self.tools[index];
            let start_pending = !acc.started && !acc.id.is_empty() && !acc.name.is_empty();
            if start_pending {
                acc.started = true;
                let id = acc.id.clone();
                let name = acc.name.clone();
                self.close_thinking(events);
                events.push(StreamEvent::ToolCallStart { id, name });
            }
            let acc = &mut self.tools[index];
            if let Some(fragment) = fragment {
                acc.args.push_str(&fragment);
                if acc.started {
                    events.push(StreamEvent::ToolCallDelta {
                        id: acc.id.clone(),
                        delta: fragment,
                    });
                }
            }
        }
    }
}

impl SseParser for Parser {
    fn parse_line(&mut self, data: &str) -> Result<Vec<StreamEvent>, ProviderError> {
        if data == "[DONE]" {
            let mut events = Vec::new();
            self.close_thinking(&mut events);
            self.end_pending_tools(&mut events);
            events.push(StreamEvent::Done {
                stop_reason: self.stop,
                usage: self.usage(),
                ttft_ms: None,
            });
            return Ok(events);
        }
        let chunk: StreamChunk = serde_json::from_str(data)
            .map_err(|e| ProviderError::protocol(format!("bad chunk: {e}")))?;
        if let Some(usage) = chunk.usage {
            self.usage = Some(usage);
            return Ok(Vec::new());
        }
        let mut events = Vec::new();
        let choice = chunk.choices.into_iter().next();
        if let Some(reason) = choice.as_ref().and_then(|c| c.finish_reason.as_deref()) {
            self.stop = map_finish_reason(reason);
            if reason == "tool_calls" {
                self.close_thinking(&mut events);
                self.end_pending_tools(&mut events);
            }
        }
        if let Some(delta) = choice.and_then(|c| c.delta) {
            let reasoning = delta
                .reasoning_content
                .or(delta.reasoning)
                .filter(|t| !t.is_empty());
            if let Some(reasoning) = reasoning {
                if !self.thinking_open {
                    self.thinking_open = true;
                    events.push(StreamEvent::ThinkingStart);
                }
                events.push(StreamEvent::ThinkingDelta { delta: reasoning });
            }
            let content = delta.content.filter(|t| !t.is_empty());
            if let Some(content) = content {
                self.close_thinking(&mut events);
                events.push(StreamEvent::TextDelta { delta: content });
            }
            self.tool_events(delta.tool_calls, &mut events);
        }
        Ok(events)
    }

    fn on_eof(&mut self) -> Option<Usage> {
        self.usage()
    }

    fn flush(&mut self) -> Vec<StreamEvent> {
        let mut events = Vec::new();
        self.close_thinking(&mut events);
        self.end_pending_tools(&mut events);
        events
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
            let mut body = serde_json::json!({
                "model": req.model,
                "messages": req.messages.iter().filter_map(|m| role_text(m).map(|(role, text)| serde_json::json!({
                    "role": role,
                    "content": text,
                }))).collect::<Vec<_>>(),
                "stream": true,
                "stream_options": { "include_usage": true },
            });
            if let Some(effort) = req.thinking_effort.as_deref().filter(|e| !e.is_empty()) {
                body["reasoning_effort"] = serde_json::Value::String(effort.to_string());
            }
            let start = Instant::now();
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
            Ok(timed(
                start,
                events_from_sse(
                    bytes,
                    Parser {
                        usage: None,
                        stop: StopReason::Stop,
                        thinking_open: false,
                        tools: Vec::new(),
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
            tools: Vec::new(),
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
    fn plain_text_stream() -> Result<(), ProviderError> {
        let sse = "\
data: {\"choices\":[{\"delta\":{\"content\":\"你好\"},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{\"content\":\"世界\"},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\
data: {\"choices\":[],\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":4}}\n\
data: [DONE]\n";
        let events = futures::executor::block_on(collect(sse))?;
        assert_eq!(
            events,
            vec![
                StreamEvent::Start,
                StreamEvent::TextStart,
                StreamEvent::TextDelta {
                    delta: "你好".into()
                },
                StreamEvent::TextDelta {
                    delta: "世界".into()
                },
                StreamEvent::TextEnd,
                StreamEvent::Done {
                    stop_reason: StopReason::Stop,
                    usage: Some(Usage {
                        input: 10,
                        output: 4,
                        cache_read: None,
                        cache_write: None,
                    }),
                    ttft_ms: None,
                },
            ]
        );
        Ok(())
    }

    #[test]
    fn thinking_text_and_tool_call_stream() -> Result<(), ProviderError> {
        let sse = "\
data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"让我\"},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{\"reasoning\":\"想想\"},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{\"content\":\"答案\"},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_1\",\"function\":{\"name\":\"get_weather\",\"arguments\":\"\"}}]},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"{\\\"city\\\":\"}}]},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"\\\"北京\\\"}\"}}]},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"tool_calls\"}]}\n\
data: [DONE]\n";
        let events = futures::executor::block_on(collect(sse))?;
        assert_eq!(
            events,
            vec![
                StreamEvent::Start,
                StreamEvent::ThinkingStart,
                StreamEvent::ThinkingDelta {
                    delta: "让我".into()
                },
                StreamEvent::ThinkingDelta {
                    delta: "想想".into()
                },
                StreamEvent::ThinkingEnd { signature: None },
                StreamEvent::TextStart,
                StreamEvent::TextDelta {
                    delta: "答案".into()
                },
                StreamEvent::TextEnd,
                StreamEvent::ToolCallStart {
                    id: "call_1".into(),
                    name: "get_weather".into(),
                },
                StreamEvent::ToolCallDelta {
                    id: "call_1".into(),
                    delta: "{\"city\":".into(),
                },
                StreamEvent::ToolCallDelta {
                    id: "call_1".into(),
                    delta: "\"北京\"}".into(),
                },
                StreamEvent::ToolCallEnd {
                    call: ToolCall {
                        id: "call_1".into(),
                        name: "get_weather".into(),
                        arguments: serde_json::json!({"city": "北京"}),
                    },
                },
                StreamEvent::Done {
                    stop_reason: StopReason::ToolUse,
                    usage: None,
                    ttft_ms: None,
                },
            ]
        );
        Ok(())
    }
}
