//! Model interface between the agent loop and model adapters: the request
//! one step sends, the stream it receives, and the contracts that bind a
//! provider endpoint to an adapter. It performs no IO.

mod adapter;
mod endpoint;
mod error;
mod request;

pub use adapter::{Adapter, BoxEventStream, BoxModelFuture, BoxModelsFuture, Connector};
pub use endpoint::{Endpoint, ProviderKind};
pub use error::ModelError;
pub use request::ModelRequest;
