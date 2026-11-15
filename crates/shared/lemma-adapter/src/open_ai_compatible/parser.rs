use lemma_core::{StopReason, StreamEvent, ToolCall, Usage};
use lemma_model::ModelError;

use crate::error;
use crate::sse::{SseEvent, SseParser};

use super::stream_chunk::{self, RawToolCall, RawUsage, StreamChunk};

pub(super) struct Parser {
    pub(super) usage: Option<RawUsage>,
    pub(super) stop: StopReason,
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
        })
    }

    fn end_tool(acc: &mut ToolAcc) -> SseEvent {
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
        .into()
    }

    fn end_pending_tools(&mut self, events: &mut Vec<SseEvent>) {
        for acc in &mut self.tools {
            if acc.started && !acc.ended {
                events.push(Self::end_tool(acc));
            }
        }
    }

    fn has_started_tools(&self) -> bool {
        self.tools.iter().any(|acc| acc.started)
    }

    fn tool_events(&mut self, calls: Vec<RawToolCall>, events: &mut Vec<SseEvent>) {
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
                events.push(StreamEvent::ToolCallStart { id, name }.into());
            }
            let acc = &mut self.tools[index];
            if let Some(fragment) = fragment {
                acc.args.push_str(&fragment);
                if acc.started {
                    events.push(StreamEvent::ToolCallDelta { delta: fragment }.into());
                }
            }
        }
    }
}

impl SseParser for Parser {
    fn parse_line(&mut self, data: &str) -> Result<Vec<SseEvent>, ModelError> {
        if data == "[DONE]" {
            let mut events = Vec::new();
            if self.stop == StopReason::Stop && self.has_started_tools() {
                self.stop = StopReason::ToolUse;
            }
            self.end_pending_tools(&mut events);
            events.push(
                StreamEvent::Done {
                    stop_reason: self.stop,
                    usage: self.usage(),
                }
                .into(),
            );
            return Ok(events);
        }
        let chunk: StreamChunk =
            serde_json::from_str(data).map_err(|e| error::protocol(format!("bad chunk: {e}")))?;
        let mut events = Vec::new();
        if let Some(usage) = chunk.usage {
            self.usage = Some(usage);
        }
        let choice = chunk.choices.into_iter().next();
        if let Some(reason) = choice.as_ref().and_then(|c| c.finish_reason.as_deref()) {
            self.stop = stream_chunk::map_finish_reason(reason);
            if reason == "tool_calls" {
                self.end_pending_tools(&mut events);
            }
        }
        if let Some(delta) = choice.and_then(|c| c.delta) {
            let reasoning = delta
                .reasoning_content
                .or(delta.reasoning)
                .filter(|t| !t.is_empty());
            if let Some(reasoning) = reasoning {
                events.push(StreamEvent::ThinkingDelta { delta: reasoning }.into());
            }
            let content = delta.content.filter(|t| !t.is_empty());
            if let Some(content) = content {
                events.push(StreamEvent::TextDelta { delta: content }.into());
            }
            self.tool_events(delta.tool_calls, &mut events);
        }
        Ok(events)
    }

    fn on_eof(&mut self) -> Option<Usage> {
        self.usage()
    }

    fn on_stop_reason(&self) -> StopReason {
        if self.stop == StopReason::Stop && self.has_started_tools() {
            StopReason::ToolUse
        } else {
            self.stop
        }
    }

    fn flush(&mut self) -> Vec<SseEvent> {
        let mut events = Vec::new();
        self.end_pending_tools(&mut events);
        events
    }
}
