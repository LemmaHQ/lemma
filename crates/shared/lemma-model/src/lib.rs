//! Model interface between the agent loop and model adapters: the request
//! one step sends, the stream it receives, and the contracts that bind a
//! provider endpoint to an adapter. It performs no IO.

mod adapter;
mod endpoint;
mod model_error;
mod model_request;

pub use adapter::{Adapter, BoxEventStream, Connector};
pub use endpoint::{Endpoint, ProviderKind};
pub use model_error::ModelError;
pub use model_request::ModelRequest;
