//! SSE line decoding shared by the adapters.
//!
//! Beyond turning `data:` payloads into parser events, this layer
//! synthesizes the canonical block lifecycle: every stream opens with
//! `Start`, the first `TextDelta` is preceded by `TextStart`, and an open
//! text block is closed with `TextEnd` before the terminal `Done`. `Done`
//! is emitted exactly once, at the terminal event or at EOF.

use std::pin::Pin;

use futures::{Stream, StreamExt, stream};
use lemma_core::{StopReason, StreamEvent, Usage};

use crate::error::ProviderError;
use crate::provider::BoxEventStream;
use crate::transport::ByteStream;

/// Parses a provider's SSE `data:` payloads into canonical events.
pub(crate) trait SseParser: Send + 'static {
    fn parse_line(&mut self, data: &str) -> Result<Vec<StreamEvent>, ProviderError>;
    /// Flushes pending state when the stream ends without a terminal
    /// event; used for token usage on APIs with no `[DONE]` sentinel.
    fn on_eof(&mut self) -> Option<Usage> {
        None
    }
    /// Events still owed at EOF, e.g. closing an open thinking block on
    /// APIs with no terminal event; emitted ahead of the synthesized
    /// `Done`.
    fn flush(&mut self) -> Vec<StreamEvent> {
        Vec::new()
    }
    /// Stop reason reported for the EOF-synthesized `Done`; APIs with a
    /// terminal event leave the default.
    fn on_stop_reason(&self) -> StopReason {
        StopReason::Stop
    }
}

type ByteLines = Pin<Box<dyn Stream<Item = Result<String, ProviderError>> + Send>>;

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
    started: bool,
    text_open: bool,
    done_seen: bool,
}

impl State {
    fn new(bytes: ByteStream, parser: impl SseParser) -> Self {
        Self {
            lines: lines(bytes),
            parser: Box::new(parser),
            started: false,
            text_open: false,
            done_seen: false,
        }
    }

    /// Queues events, wrapping text deltas in the canonical block
    /// lifecycle. Parsers may also drive the lifecycle explicitly with
    /// their own `TextStart`/`TextEnd`; an open text block is closed
    /// before a thinking or tool-call block starts and before `Done`.
    fn wrap(&mut self, events: Vec<StreamEvent>) -> Vec<StreamEvent> {
        let mut out = Vec::with_capacity(events.len() + 2);
        for event in events {
            match &event {
                StreamEvent::TextStart => self.text_open = true,
                StreamEvent::TextEnd => self.text_open = false,
                StreamEvent::TextDelta { .. } if !self.text_open => {
                    self.text_open = true;
                    out.push(StreamEvent::TextStart);
                }
                StreamEvent::ThinkingStart | StreamEvent::ToolCallStart { .. }
                    if self.text_open =>
                {
                    self.text_open = false;
                    out.push(StreamEvent::TextEnd);
                }
                StreamEvent::Done { .. } => {
                    if self.text_open {
                        self.text_open = false;
                        out.push(StreamEvent::TextEnd);
                    }
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
                if !state.started {
                    state.started = true;
                    return Ok(Some((StreamEvent::Start, (state, pending))));
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
                        events.push(StreamEvent::Done {
                            stop_reason,
                            usage,
                            ttft_ms: None,
                        });
                        pending = state.wrap(events).into_iter();
                    }
                }
            }
        },
    );
    Box::pin(s)
}
