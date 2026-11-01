use std::mem;

use lemma_core::{StopReason, StreamEvent, ToolCall, Usage};
use lemma_model::ModelError;

use crate::error;
use crate::sse::SseParser;

use super::event::{self, ContentBlockStart, Delta, Event, RawUsage};

pub(super) struct Parser {
    pub(super) input: Option<i64>,
    pub(super) output: Option<i64>,
    pub(super) stop: StopReason,
    pub(super) block: Block,
    pub(super) signature: String,
}

pub(super) enum Block {
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
                    Block::Tool { args, .. } => {
                        args.push_str(&fragment);
                        vec![StreamEvent::ToolCallDelta { delta: fragment }]
                    }
                    _ => Vec::new(),
                }
            }
            _ => Vec::new(),
        }
    }

    fn block_stop(&mut self) -> Vec<StreamEvent> {
        let block = mem::replace(&mut self.block, Block::None);
        match block {
            Block::Text => vec![StreamEvent::TextEnd],
            Block::Thinking => {
                let signature = if self.signature.is_empty() {
                    None
                } else {
                    Some(mem::take(&mut self.signature))
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
                        started_at: None,
                        finished_at: None,
                    },
                }]
            }
            Block::None => Vec::new(),
        }
    }
}

impl SseParser for Parser {
    fn parse_line(&mut self, data: &str) -> Result<Vec<StreamEvent>, ModelError> {
        let event: Event =
            serde_json::from_str(data).map_err(|e| error::protocol(format!("bad event: {e}")))?;
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
                    self.stop = event::map_stop_reason(reason);
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
            "error" => Err(error::protocol(format!(
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
