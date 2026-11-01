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
