use std::future::Future;
use std::pin::Pin;

use futures::Stream;
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
