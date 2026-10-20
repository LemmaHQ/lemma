use futures::StreamExt;
use lemma_core::{
    ContentBlock, StopReason, StreamEvent, TextContent, ThinkingContent, ToolCall, Usage,
};
use lemma_model::{Adapter, BoxEventStream, ModelError, ModelRequest};

use crate::cancel::CancelToken;
use crate::event::{TurnEvent, TurnObserver};
use crate::persist::now_ms;

/// How one model stream ended.
pub(crate) enum StepEnd {
    Completed,
    Failed(String),
    Aborted,
}

/// Settled result of one model stream: accumulated blocks, terminal
/// state, and timing marks.
pub(crate) struct StepOutcome {
    pub(crate) blocks: Vec<ContentBlock>,
    pub(crate) stop_reason: StopReason,
    pub(crate) usage: Option<Usage>,
    pub(crate) first_token_at: Option<i64>,
    pub(crate) end: StepEnd,
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

    pub(crate) fn tool_calls(&self) -> Vec<ToolCall> {
        self.blocks
            .iter()
            .filter_map(|b| match b {
                ContentBlock::ToolCall(call) => Some(call.clone()),
                _ => None,
            })
            .collect()
    }
}

/// The currently open content block while accumulating a stream.
enum OpenBlock {
    Text(String),
    Thinking(String),
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
            Self::Thinking(thinking) => ContentBlock::Thinking(ThinkingContent {
                thinking,
                signature,
            }),
            Self::ToolCall {
                id,
                name,
                arguments,
            } => ContentBlock::ToolCall(ToolCall {
                id,
                name,
                arguments: serde_json::from_str(&arguments)
                    .unwrap_or(serde_json::Value::String(arguments)),
            }),
        }
    }
}

/// Folds stream events into content blocks, forwarding deltas to the
/// observer.
struct Accumulator<'a> {
    blocks: Vec<ContentBlock>,
    open: Option<OpenBlock>,
    usage: Option<Usage>,
    stop_reason: StopReason,
    first_token_at: Option<i64>,
    started_at: i64,
    observer: TurnObserver<'a>,
}

impl Accumulator<'_> {
    fn close_open(&mut self, signature: Option<String>) {
        if let Some(prev) = self.open.take() {
            self.blocks.push(prev.close(signature));
        }
    }

    fn reopen(&mut self, block: OpenBlock) {
        self.close_open(None);
        self.open = Some(block);
    }

    fn apply(&mut self, event: StreamEvent) -> Result<(), String> {
        match event {
            StreamEvent::Start => {}
            StreamEvent::TextStart => self.reopen(OpenBlock::Text(String::new())),
            StreamEvent::TextDelta { delta } => {
                if self.first_token_at.is_none() {
                    self.first_token_at = Some(now_ms());
                }
                if !matches!(self.open, Some(OpenBlock::Text(_))) {
                    self.reopen(OpenBlock::Text(String::new()));
                }
                if let Some(OpenBlock::Text(text)) = &mut self.open {
                    text.push_str(&delta);
                }
                (self.observer)(TurnEvent::Delta { delta });
            }
            StreamEvent::TextEnd => self.close_open(None),
            StreamEvent::ThinkingStart => self.reopen(OpenBlock::Thinking(String::new())),
            StreamEvent::ThinkingDelta { delta } => {
                if !matches!(self.open, Some(OpenBlock::Thinking(_))) {
                    self.reopen(OpenBlock::Thinking(String::new()));
                }
                if let Some(OpenBlock::Thinking(thinking)) = &mut self.open {
                    thinking.push_str(&delta);
                }
                (self.observer)(TurnEvent::ThinkingDelta { delta });
            }
            StreamEvent::ThinkingEnd { signature } => self.close_open(signature),
            StreamEvent::ToolCallStart { id, name } => self.reopen(OpenBlock::ToolCall {
                id,
                name,
                arguments: String::new(),
            }),
            StreamEvent::ToolCallDelta { delta, .. } => {
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
            StreamEvent::Done {
                stop_reason,
                usage,
                ttft_ms,
            } => {
                self.stop_reason = stop_reason;
                self.usage = usage;
                if let Some(ttft) = ttft_ms {
                    self.first_token_at = Some(self.started_at + ttft as i64);
                }
            }
            StreamEvent::Error { message } => return Err(message),
        }
        Ok(())
    }

    async fn drain(&mut self, mut stream: BoxEventStream) -> Result<(), String> {
        while let Some(event) = stream.next().await {
            self.apply(event.map_err(|e: ModelError| e.message)?)?;
        }
        Ok(())
    }
}

/// Runs one model stream to completion or cancellation, accumulating
/// content blocks and forwarding deltas to `observer`.
pub(crate) async fn run_stream(
    adapter: &dyn Adapter,
    req: ModelRequest,
    started_at: i64,
    observer: TurnObserver<'_>,
    cancel: &CancelToken,
) -> StepOutcome {
    let mut acc = Accumulator {
        blocks: Vec::new(),
        open: None,
        usage: None,
        stop_reason: StopReason::Stop,
        first_token_at: None,
        started_at,
        observer,
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
    acc.close_open(None);
    let stop_reason = match end {
        StepEnd::Aborted => StopReason::Aborted,
        StepEnd::Completed | StepEnd::Failed(_) => acc.stop_reason,
    };
    StepOutcome {
        blocks: acc.blocks,
        stop_reason,
        usage: acc.usage,
        first_token_at: acc.first_token_at,
        end,
    }
}
