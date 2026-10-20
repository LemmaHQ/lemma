use std::pin::Pin;
use std::sync::Arc;

use futures::Stream;
use lemma_core::StreamEvent;

use crate::endpoint::Endpoint;
use crate::error::ModelError;
use crate::request::ModelRequest;

/// Stream of canonical generation events produced by an adapter.
pub type BoxEventStream = Pin<Box<dyn Stream<Item = Result<StreamEvent, ModelError>> + Send>>;

/// Future that establishes the upstream connection and yields the event
/// stream.
pub type BoxModelFuture = Pin<Box<dyn Future<Output = Result<BoxEventStream, ModelError>> + Send>>;

/// Future that yields the model ids an endpoint reports.
pub type BoxModelsFuture = Pin<Box<dyn Future<Output = Result<Vec<String>, ModelError>> + Send>>;

/// A model bound to one provider endpoint and its credentials.
///
/// Implementations translate the canonical request into their vendor's
/// wire format and the vendor's response stream back into canonical
/// [`StreamEvent`]s.
pub trait Adapter: Send + Sync {
    /// Starts a streaming model call.
    fn stream(&self, req: ModelRequest) -> BoxModelFuture;
}

/// Binds provider endpoints to adapters and lists their models.
pub trait Connector: Send + Sync {
    /// Returns the adapter for `endpoint`'s kind, bound to its URL and key.
    fn connect(&self, endpoint: Endpoint) -> Arc<dyn Adapter>;

    /// Fetches the model ids `endpoint` reports.
    fn list_models(&self, endpoint: Endpoint) -> BoxModelsFuture;
}
