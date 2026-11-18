//! Opens the engine over a data directory, with the `lemma-rpc` router over
//! its database, secrets, and workspaces, and serves that router inside the
//! process for hosts without a network listener.

mod engine;
mod engine_open_error;
mod in_process_engine;
mod in_process_transport;
mod in_process_transport_error;
mod secrets;

pub use engine::Engine;
pub use engine_open_error::EngineOpenError;
pub use in_process_engine::InProcessEngine;
pub use in_process_transport::{InProcessTransport, ResponseHead};
pub use in_process_transport_error::InProcessTransportError;
