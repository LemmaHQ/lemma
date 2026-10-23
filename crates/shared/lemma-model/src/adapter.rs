use std::pin::Pin;

use futures::Stream;
use lemma_core::StreamEvent;

use crate::endpoint::Endpoint;
use crate::model_error::ModelError;
use crate::model_request::ModelRequest;

/// Stream of canonical generation events produced by an adapter.
pub type BoxEventStream = Pin<Box<dyn Stream<Item = Result<StreamEvent, ModelError>> + Send>>;

/// A model bound to one provider endpoint and its credentials.
///
/// Implementations translate the canonical request into their vendor's
/// wire format and the vendor's response stream back into canonical
/// [`StreamEvent`]s.
pub trait Adapter: Send + Sync {
    /// Establishes the upstream connection of a streaming model call and
    /// yields its event stream.
    fn stream(
        &self,
        req: ModelRequest,
    ) -> impl Future<Output = Result<BoxEventStream, ModelError>> + Send;
}

/// Binds provider endpoints to adapters and lists their models.
pub trait Connector: Send + Sync + 'static {
    /// Adapter the connector binds endpoints to.
    type Adapter: Adapter + 'static;

    /// Returns the adapter for `endpoint`'s kind, bound to its URL and key.
    fn connect(&self, endpoint: Endpoint) -> Self::Adapter;

    /// Fetches the model ids `endpoint` reports.
    fn list_models(
        &self,
        endpoint: Endpoint,
    ) -> impl Future<Output = Result<Vec<String>, ModelError>> + Send;
}
