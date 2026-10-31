use chrono::{DateTime, Utc};
use lemma_core::{
    ContentBlock, StopReason, StreamEvent, TextContent, ThinkingContent, ToolCall, Usage,
};
use lemma_model::{Adapter, BoxEventStream, ModelError, ModelRequest};
use serde_json::Value;

use crate::cancel_token::CancelToken;
use crate::turn_event::TurnEvent;

/// How one model stream ended.
pub(crate) enum StepEnd {
    Completed,
    Failed(String),
    Aborted,
}

/// Settled result of one model stream: accumulated blocks and terminal
/// state.
pub(crate) struct StepOutcome {
    pub(crate) blocks: Vec<ContentBlock>,
    pub(crate) stop_reason: StopReason,
    pub(crate) usage: Option<Usage>,
    pub(crate) end: StepEnd,
    pub(crate) ended_at: DateTime<Utc>,
}

impl StepOutcome {
    pub(crate) fn full_text(&self) -> String {
        self.blocks
            .iter()
            .filter_map(ContentBlock::plain_text)
            .collect()
    }

    pub(crate) fn content(&self) -> Vec<ContentBlock> {
        if self
            .blocks
            .iter()
            .all(|b| matches!(b, ContentBlock::Text(_)))
        {
            vec![ContentBlock::Text(TextContent {
                text: self.full_text(),
            })]
        } else {
            self.blocks.clone()
        }
    }

    pub(crate) fn finish_thinking(&mut self, at: DateTime<Utc>) {
        for block in &mut self.blocks {
            if let ContentBlock::Thinking(thinking) = block
                && thinking.started_at.is_some()
                && thinking.finished_at.is_none()
            {
                thinking.finished_at = Some(at);
            }
        }
    }
}

/// The currently open content block while accumulating a stream.
enum OpenBlock {
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

/// Folds stream events into content blocks, forwarding deltas to the
/// observer.
struct Accumulator<'obs, O> {
    blocks: Vec<ContentBlock>,
    open: Option<OpenBlock>,
    usage: Option<Usage>,
    stop_reason: StopReason,
    observer: &'obs O,
    pending_thinking: Option<usize>,
    ended_at: Option<DateTime<Utc>>,
}

impl<O: Fn(TurnEvent)> Accumulator<'_, O> {
    fn close_open(&mut self, signature: Option<String>) {
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

    fn finish_thinking(&mut self, at: DateTime<Utc>) {
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

    fn apply(&mut self, event: StreamEvent) -> Result<(), String> {
        match event {
            StreamEvent::TextStart => self.reopen(OpenBlock::Text(String::new())),
            StreamEvent::TextDelta { delta } => {
                let at = Utc::now();
                self.finish_thinking(at);
                if !matches!(self.open, Some(OpenBlock::Text(_))) {
                    self.reopen(OpenBlock::Text(String::new()));
                }
                if let Some(OpenBlock::Text(text)) = &mut self.open {
                    text.push_str(&delta);
                }
                (self.observer)(TurnEvent::Delta { delta, at });
            }
            StreamEvent::TextEnd => self.close_open(None),
            StreamEvent::ThinkingStart => self.reopen(OpenBlock::Thinking {
                text: String::new(),
                started_at: None,
                finished_at: None,
            }),
            StreamEvent::ThinkingDelta { delta } => {
                let at = Utc::now();
                if !matches!(self.open, Some(OpenBlock::Thinking { .. })) {
                    self.reopen(OpenBlock::Thinking {
                        text: String::new(),
                        started_at: None,
                        finished_at: None,
                    });
                }
                if let Some(OpenBlock::Thinking {
                    text, started_at, ..
                }) = &mut self.open
                {
                    text.push_str(&delta);
                    started_at.get_or_insert(at);
                }
                (self.observer)(TurnEvent::ThinkingDelta { delta, at });
            }
            StreamEvent::ThinkingEnd { signature } => self.close_open(signature),
            StreamEvent::ToolCallStart { id, name } => {
                self.reopen(OpenBlock::ToolCall {
                    id,
                    name,
                    arguments: String::new(),
                });
            }
            StreamEvent::ToolCallDelta { delta } => {
                if let Some(OpenBlock::ToolCall { arguments, .. }) = &mut self.open {
                    arguments.push_str(&delta);
                }
            }
            StreamEvent::ToolCallEnd { call } => {
                match self.open.take() {
                    Some(OpenBlock::ToolCall { ref id, .. }) if *id == call.id => {}
                    Some(prev) => self.blocks.push(prev.close(None)),
                    None => {}
                }
                self.blocks.push(ContentBlock::ToolCall(call));
            }
            StreamEvent::Done { stop_reason, usage } => {
                let at = Utc::now();
                self.ended_at = Some(at);
                self.stop_reason = stop_reason;
                self.usage = usage;
            }
        }
        Ok(())
    }

    async fn drain(&mut self, mut stream: BoxEventStream) -> Result<(), String> {
        use futures::StreamExt;

        while let Some(event) = stream.next().await {
            self.apply(event.map_err(|e: ModelError| e.message)?)?;
        }
        Ok(())
    }
}

/// Runs one model stream to completion or cancellation, accumulating
/// content blocks and forwarding deltas to `observer`.
pub(crate) async fn run_stream<A: Adapter, O: Fn(TurnEvent)>(
    adapter: &A,
    req: ModelRequest,
    observer: &O,
    cancel: &CancelToken,
) -> StepOutcome {
    let mut acc = Accumulator {
        blocks: Vec::new(),
        open: None,
        usage: None,
        stop_reason: StopReason::Stop,
        observer,
        pending_thinking: None,
        ended_at: None,
    };
    let streamed = async {
        let stream = adapter.stream(req).await.map_err(|e| e.message)?;
        acc.drain(stream).await
    };
    let end = tokio::select! {
        result = streamed => match result {
            Ok(()) => StepEnd::Completed,
            Err(message) => StepEnd::Failed(message),
        },
        () = cancel.cancelled() => StepEnd::Aborted,
    };
    let ended_at = acc.ended_at.unwrap_or_else(Utc::now);
    if !matches!(end, StepEnd::Completed) || acc.stop_reason != StopReason::ToolUse {
        acc.finish_thinking(ended_at);
    }
    acc.close_open(None);
    let stop_reason = match end {
        StepEnd::Aborted => StopReason::Aborted,
        StepEnd::Completed | StepEnd::Failed(_) => acc.stop_reason,
    };
    StepOutcome {
        blocks: acc.blocks,
        stop_reason,
        usage: acc.usage,
        end,
        ended_at,
    }
}
