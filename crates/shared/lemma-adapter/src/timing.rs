use std::time::Instant;

use futures::StreamExt;
use lemma_core::StreamEvent;
use lemma_model::BoxEventStream;

/// Wraps an event stream with time-to-first-token measurement.
///
/// Adapters record `start` just before dispatching the HTTP request; the
/// first content delta (text, thinking, or tool-call) fixes the TTFT,
/// which is then filled into the pass-through `Done` event.
pub(crate) fn timed(start: Instant, stream: BoxEventStream) -> BoxEventStream {
    let mut ttft: Option<u64> = None;
    Box::pin(stream.map(move |item| {
        item.map(|event| {
            match &event {
                StreamEvent::TextDelta { .. }
                | StreamEvent::ThinkingDelta { .. }
                | StreamEvent::ToolCallDelta { .. }
                    if ttft.is_none() =>
                {
                    ttft = Some(start.elapsed().as_millis() as u64);
                }
                _ => {}
            }
            match event {
                StreamEvent::Done {
                    stop_reason, usage, ..
                } => StreamEvent::Done {
                    stop_reason,
                    usage,
                    ttft_ms: ttft,
                },
                other => other,
            }
        })
    }))
}
