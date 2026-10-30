use lemma_core::{StopReason, StreamEvent, ToolCall, Usage};
use lemma_model::ModelError;

use crate::error;
use crate::sse::SseParser;

use super::stream_chunk::{self, RawToolCall, RawUsage, StreamChunk};

pub(super) struct Parser {
    pub(super) usage: Option<RawUsage>,
    pub(super) stop: StopReason,
    pub(super) thinking_open: bool,
    pub(super) tools: Vec<ToolAcc>,
}

#[derive(Default)]
pub(super) struct ToolAcc {
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
                started_at: None,
                finished_at: None,
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
    fn parse_line(&mut self, data: &str) -> Result<Vec<StreamEvent>, ModelError> {
        if data == "[DONE]" {
            let mut events = Vec::new();
            self.close_thinking(&mut events);
            self.end_pending_tools(&mut events);
            events.push(StreamEvent::Done {
                stop_reason: self.stop,
                usage: self.usage(),
            });
            return Ok(events);
        }
        let chunk: StreamChunk =
            serde_json::from_str(data).map_err(|e| error::protocol(format!("bad chunk: {e}")))?;
        if let Some(usage) = chunk.usage {
            self.usage = Some(usage);
            return Ok(Vec::new());
        }
        let mut events = Vec::new();
        let choice = chunk.choices.into_iter().next();
        if let Some(reason) = choice.as_ref().and_then(|c| c.finish_reason.as_deref()) {
            self.stop = stream_chunk::map_finish_reason(reason);
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

#[cfg(test)]
mod tests {
    use futures::executor;
    use futures::{StreamExt, stream};
    use lemma_core::ToolCall;

    use super::*;
    use crate::http_transport::ByteStream;
    use crate::sse;

    fn parser() -> Parser {
        Parser {
            usage: None,
            stop: StopReason::Stop,
            thinking_open: false,
            tools: Vec::new(),
        }
    }

    async fn collect(sse: &str) -> Result<Vec<StreamEvent>, ModelError> {
        let bytes: ByteStream = Box::pin(stream::iter(vec![Ok::<_, ModelError>(
            sse.as_bytes().to_vec(),
        )]));
        sse::events_from_sse(bytes, parser())
            .collect::<Vec<_>>()
            .await
            .into_iter()
            .collect()
    }

    #[test]
    fn plain_text_stream() -> Result<(), ModelError> {
        let sse = "\
data: {\"choices\":[{\"delta\":{\"content\":\"你好\"},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{\"content\":\"世界\"},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\
data: {\"choices\":[],\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":4}}\n\
data: [DONE]\n";
        let events = executor::block_on(collect(sse))?;
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
                },
            ]
        );
        Ok(())
    }

    #[test]
    fn thinking_text_and_tool_call_stream() -> Result<(), ModelError> {
        let sse = "\
data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"让我\"},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{\"reasoning\":\"想想\"},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{\"content\":\"答案\"},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_1\",\"function\":{\"name\":\"get_weather\",\"arguments\":\"\"}}]},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"{\\\"city\\\":\"}}]},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"\\\"北京\\\"}\"}}]},\"finish_reason\":null}]}\n\
data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"tool_calls\"}]}\n\
data: [DONE]\n";
        let events = executor::block_on(collect(sse))?;
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
                        started_at: None,
                        finished_at: None,
                    },
                },
                StreamEvent::Done {
                    stop_reason: StopReason::ToolUse,
                    usage: None,
                },
            ]
        );
        Ok(())
    }
}
