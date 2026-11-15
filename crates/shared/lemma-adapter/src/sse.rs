//! SSE line decoding shared by the adapters.
//!
//! Beyond turning `data:` payloads into parser events, this layer
//! synthesizes the canonical block lifecycle: `TextDelta` opens a text block
//! with `TextStart`, `ThinkingDelta` opens a thinking block with
//! `ThinkingStart` (collecting any emitted signature fragments), an open
//! block closes before a different block kind starts, and any open block
//! closes ahead of the terminal `Done`. `Done` is emitted exactly once, at
//! the terminal event or at EOF.

use std::mem;
use std::pin::Pin;

use futures::{Stream, StreamExt, stream};
use lemma_core::{StopReason, StreamEvent, Usage};
use lemma_model::{BoxEventStream, ModelError};

use crate::http_transport::ByteStream;

/// Output produced by an [`SseParser`]: either a stream event or a signature
/// fragment attached to the current thinking block.
pub(crate) enum SseEvent {
    Stream(StreamEvent),
    ThinkingSignature(String),
}

impl From<StreamEvent> for SseEvent {
    fn from(event: StreamEvent) -> Self {
        Self::Stream(event)
    }
}

/// Parses a provider's SSE `data:` payloads into canonical events.
pub(crate) trait SseParser: Send + 'static {
    fn parse_line(&mut self, data: &str) -> Result<Vec<SseEvent>, ModelError>;
    /// Flushes pending state when the stream reaches EOF directly;
    /// extracts token usage from APIs providing usage metrics on the last chunk.
    fn on_eof(&mut self) -> Option<Usage>;
    /// Events emitted at stream closure, ahead of the synthesized `Done`.
    fn flush(&mut self) -> Vec<SseEvent> {
        Vec::new()
    }
    /// Stop reason reported for the EOF-synthesized `Done`; APIs with a
    /// terminal event leave the default.
    fn on_stop_reason(&self) -> StopReason {
        StopReason::Stop
    }
}

type ByteLines = Pin<Box<dyn Stream<Item = Result<String, ModelError>> + Send>>;

fn lines(bytes: ByteStream) -> ByteLines {
    Box::pin(stream::try_unfold(
        (bytes, Vec::<u8>::new()),
        |(mut bytes, mut buf)| async move {
            loop {
                if let Some(pos) = buf.iter().position(|b| *b == b'\n') {
                    let raw: Vec<u8> = buf.drain(..=pos).collect();
                    let line = String::from_utf8_lossy(&raw)
                        .trim_end_matches('\r')
                        .to_string();
                    return Ok(Some((line, (bytes, buf))));
                }
                match bytes.next().await {
                    Some(Ok(chunk)) => buf.extend_from_slice(&chunk),
                    Some(Err(e)) => return Err(e),
                    None if buf.is_empty() => return Ok(None),
                    None => {
                        let line = String::from_utf8_lossy(&buf).trim().to_string();
                        buf.clear();
                        return Ok(Some((line, (bytes, buf))));
                    }
                }
            }
        },
    ))
}

struct State {
    lines: ByteLines,
    parser: Box<dyn SseParser>,
    text_open: bool,
    thinking_open: bool,
    thinking_signature: String,
    done_seen: bool,
}

impl State {
    fn new(bytes: ByteStream, parser: impl SseParser) -> Self {
        Self {
            lines: lines(bytes),
            parser: Box::new(parser),
            text_open: false,
            thinking_open: false,
            thinking_signature: String::new(),
            done_seen: false,
        }
    }

    fn close_text(&mut self, out: &mut Vec<StreamEvent>) {
        if self.text_open {
            self.text_open = false;
            out.push(StreamEvent::TextEnd);
        }
    }

    fn close_thinking(&mut self, out: &mut Vec<StreamEvent>) {
        if self.thinking_open {
            self.thinking_open = false;
            let signature = (!self.thinking_signature.is_empty())
                .then(|| mem::take(&mut self.thinking_signature));
            out.push(StreamEvent::ThinkingEnd { signature });
        }
    }

    fn wrap(&mut self, events: Vec<SseEvent>) -> Vec<StreamEvent> {
        let mut out = Vec::with_capacity(events.len() + 2);
        for item in events {
            let event = match item {
                SseEvent::ThinkingSignature(signature) => {
                    self.thinking_signature.push_str(&signature);
                    continue;
                }
                SseEvent::Stream(event) => event,
            };
            match &event {
                StreamEvent::TextStart => {
                    self.close_thinking(&mut out);
                    self.thinking_signature.clear();
                    self.text_open = true;
                }
                StreamEvent::TextEnd => self.text_open = false,
                StreamEvent::TextDelta { .. } if !self.text_open => {
                    self.close_thinking(&mut out);
                    self.thinking_signature.clear();
                    self.text_open = true;
                    out.push(StreamEvent::TextStart);
                }
                StreamEvent::ThinkingStart => {
                    self.close_text(&mut out);
                    self.thinking_open = true;
                    self.thinking_signature.clear();
                }
                StreamEvent::ThinkingEnd { .. } => {
                    self.close_thinking(&mut out);
                    continue;
                }
                StreamEvent::ThinkingDelta { .. } if !self.thinking_open => {
                    self.close_text(&mut out);
                    self.thinking_open = true;
                    out.push(StreamEvent::ThinkingStart);
                }
                StreamEvent::ToolCallStart { .. } => {
                    self.close_text(&mut out);
                    self.close_thinking(&mut out);
                    self.thinking_signature.clear();
                }
                StreamEvent::Done { .. } => {
                    self.close_text(&mut out);
                    self.close_thinking(&mut out);
                    self.thinking_signature.clear();
                    self.done_seen = true;
                }
                _ => {}
            }
            out.push(event);
        }
        out
    }
}

/// Turns an upstream byte stream into canonical events. Only `data:` lines
/// are considered.
pub(crate) fn events_from_sse(bytes: ByteStream, parser: impl SseParser) -> BoxEventStream {
    let s = stream::try_unfold(
        (
            State::new(bytes, parser),
            Vec::<StreamEvent>::new().into_iter(),
        ),
        |(mut state, mut pending)| async move {
            loop {
                if let Some(event) = pending.next() {
                    return Ok(Some((event, (state, pending))));
                }
                if state.done_seen {
                    return Ok(None);
                }
                match state.lines.next().await {
                    Some(Ok(line)) => {
                        let data = match line.strip_prefix("data:") {
                            Some(d) => d.trim(),
                            None => continue,
                        };
                        let events = state.parser.parse_line(data)?;
                        pending = state.wrap(events).into_iter();
                    }
                    Some(Err(e)) => return Err(e),
                    None => {
                        let usage = state.parser.on_eof();
                        let stop_reason = state.parser.on_stop_reason();
                        let mut events = state.parser.flush();
                        events.push(StreamEvent::Done { stop_reason, usage }.into());
                        pending = state.wrap(events).into_iter();
                    }
                }
            }
        },
    );
    Box::pin(s)
}
