use std::future::Future;
use std::pin::Pin;
use std::time::Instant;

use futures::{Stream, StreamExt};
use lemma_core::StreamEvent;

use crate::error::ProviderError;
use crate::request::ChatRequest;

/// Stream of canonical generation events produced by a provider.
pub type BoxEventStream = Pin<Box<dyn Stream<Item = Result<StreamEvent, ProviderError>> + Send>>;

/// Future that establishes the upstream connection and yields the event
/// stream.
pub type BoxChatFuture =
    Pin<Box<dyn Future<Output = Result<BoxEventStream, ProviderError>> + Send>>;

/// A vendor-specific streaming chat implementation.
///
/// Implementations translate the canonical request into their vendor's
/// wire format and the vendor's response stream back into canonical
/// [`StreamEvent`]s. They hold no conversation state.
pub trait Provider: Send + Sync {
    /// Starts a streaming chat call.
    fn stream(&self, req: ChatRequest) -> BoxChatFuture;
}

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
