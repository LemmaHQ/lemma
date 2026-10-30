use lemma_core::{StopReason, StreamEvent, ToolCall, Usage};
use lemma_model::ModelError;

use crate::error;
use crate::sse::SseParser;

use super::chunk::{self, Chunk, Part, UsageMeta};

pub(super) struct Parser {
    pub(super) usage: Option<UsageMeta>,
    pub(super) stop: StopReason,
    pub(super) thinking_open: bool,
    pub(super) signature: Option<String>,
    pub(super) next_call: u64,
    pub(super) called_tool: bool,
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
                    started_at: None,
                    finished_at: None,
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
    fn parse_line(&mut self, data: &str) -> Result<Vec<StreamEvent>, ModelError> {
        let chunk: Chunk =
            serde_json::from_str(data).map_err(|e| error::protocol(format!("bad chunk: {e}")))?;
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
                chunk::map_finish_reason(reason)
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
            signature: None,
            next_call: 0,
            called_tool: false,
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
    fn thought_text_and_function_call_stream() -> Result<(), ModelError> {
        let sse = "\
data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"想想\",\"thought\":true}]}}]}\n\
data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"一下\",\"thought\":true,\"thoughtSignature\":\"sig_xyz\"}]}}]}\n\
data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"答案\"}]}}]}\n\
data: {\"candidates\":[{\"content\":{\"parts\":[{\"functionCall\":{\"name\":\"get_weather\",\"args\":{\"city\":\"北京\"}}}]},\"finishReason\":\"STOP\"}],\"usageMetadata\":{\"promptTokenCount\":5,\"candidatesTokenCount\":10}}\n";
        let events = executor::block_on(collect(sse))?;
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
                        started_at: None,
                        finished_at: None,
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
                },
            ]
        );
        Ok(())
    }
}
