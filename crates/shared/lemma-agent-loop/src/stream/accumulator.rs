use chrono::{DateTime, Utc};
use lemma_core::{
    ContentBlock, StopReason, StreamEvent, TextContent, ThinkingContent, ToolCall, Usage,
};
use serde_json::Value;

use crate::turn_event::TurnEvent;

/// The currently open content block while accumulating a stream.
pub(super) enum OpenBlock {
    Text(String),
    Thinking {
        text: String,
        started_at: Option<DateTime<Utc>>,
        finished_at: Option<DateTime<Utc>>,
    },
    ToolCall {
        id: String,
        name: String,
        arguments: String,
    },
}

impl OpenBlock {
    fn close(self, signature: Option<String>) -> ContentBlock {
        match self {
            Self::Text(text) => ContentBlock::Text(TextContent { text }),
            Self::Thinking {
                text,
                started_at,
                finished_at,
            } => ContentBlock::Thinking(ThinkingContent {
                thinking: text,
                signature,
                started_at,
                finished_at,
            }),
            Self::ToolCall {
                id,
                name,
                arguments,
            } => ContentBlock::ToolCall(ToolCall {
                id,
                name,
                arguments: serde_json::from_str(&arguments).unwrap_or(Value::String(arguments)),
                started_at: None,
                finished_at: None,
            }),
        }
    }
}

/// Folds stream events into content blocks.
pub(super) struct Accumulator {
    pub(super) blocks: Vec<ContentBlock>,
    pub(super) open: Option<OpenBlock>,
    pub(super) usage: Option<Usage>,
    pub(super) stop_reason: StopReason,
    pub(super) pending_thinking: Option<usize>,
    pub(super) ended_at: Option<DateTime<Utc>>,
}

impl Accumulator {
    pub(super) fn close_open(&mut self, signature: Option<String>) {
        if let Some(prev) = self.open.take() {
            let block = prev.close(signature);
            if matches!(
                &block,
                ContentBlock::Thinking(ThinkingContent {
                    started_at: Some(_),
                    finished_at: None,
                    ..
                })
            ) {
                self.pending_thinking = Some(self.blocks.len());
            }
            self.blocks.push(block);
        }
    }

    pub(super) fn finish_thinking(&mut self, at: DateTime<Utc>) {
        if let Some(OpenBlock::Thinking {
            started_at: Some(_),
            finished_at,
            ..
        }) = &mut self.open
        {
            *finished_at = Some(at);
        }
        if let Some(index) = self.pending_thinking.take()
            && let Some(ContentBlock::Thinking(thinking)) = self.blocks.get_mut(index)
        {
            thinking.finished_at = Some(at);
        }
    }

    fn reopen(&mut self, block: OpenBlock) {
        self.close_open(None);
        self.open = Some(block);
    }

    pub(super) fn apply(&mut self, event: StreamEvent) -> Option<TurnEvent> {
        match event {
            StreamEvent::TextStart => self.reopen(OpenBlock::Text(String::new())),
            StreamEvent::TextDelta { delta } => return Some(self.text_delta(delta)),
            StreamEvent::TextEnd => self.close_open(None),
            StreamEvent::ThinkingStart => self.reopen(OpenBlock::Thinking {
                text: String::new(),
                started_at: None,
                finished_at: None,
            }),
            StreamEvent::ThinkingDelta { delta } => return Some(self.thinking_delta(delta)),
            StreamEvent::ThinkingEnd { signature } => self.close_open(signature),
            StreamEvent::ToolCallStart { id, name } => {
                self.reopen(OpenBlock::ToolCall {
                    id,
                    name,
                    arguments: String::new(),
                });
            }
            StreamEvent::ToolCallDelta { delta } => self.tool_call_delta(&delta),
            StreamEvent::ToolCallEnd { call } => self.tool_call_end(call),
            StreamEvent::Done { stop_reason, usage } => self.done(stop_reason, usage),
        }
        None
    }

    fn text_delta(&mut self, delta: String) -> TurnEvent {
        let at = Utc::now();
        self.finish_thinking(at);
        match &mut self.open {
            Some(OpenBlock::Text(text)) => text.push_str(&delta),
            _ => self.reopen(OpenBlock::Text(delta.clone())),
        }
        TurnEvent::Delta { delta, at }
    }

    fn thinking_delta(&mut self, delta: String) -> TurnEvent {
        let at = Utc::now();
        match &mut self.open {
            Some(OpenBlock::Thinking {
                text, started_at, ..
            }) => {
                text.push_str(&delta);
                started_at.get_or_insert(at);
            }
            _ => self.reopen(OpenBlock::Thinking {
                text: delta.clone(),
                started_at: Some(at),
                finished_at: None,
            }),
        }
        TurnEvent::ThinkingDelta { delta, at }
    }

    fn tool_call_delta(&mut self, delta: &str) {
        if let Some(OpenBlock::ToolCall { arguments, .. }) = &mut self.open {
            arguments.push_str(delta);
        }
    }

    fn tool_call_end(&mut self, call: ToolCall) {
        match self.open.take() {
            Some(OpenBlock::ToolCall { ref id, .. }) if *id == call.id => {}
            Some(prev) => self.blocks.push(prev.close(None)),
            None => {}
        }
        let closed = self
            .blocks
            .iter_mut()
            .find(|block| matches!(block, ContentBlock::ToolCall(closed) if closed.id == call.id));
        match closed {
            Some(block) => *block = ContentBlock::ToolCall(call),
            None => self.blocks.push(ContentBlock::ToolCall(call)),
        }
    }

    fn done(&mut self, stop_reason: StopReason, usage: Option<Usage>) {
        let at = Utc::now();
        self.ended_at = Some(at);
        self.stop_reason = stop_reason;
        self.usage = usage;
    }
}
