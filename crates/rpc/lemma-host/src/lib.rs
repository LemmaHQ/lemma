//! Assembles the four Connect services into one router over a storage
//! backend, opens the local engine from its data directory, and serves the
//! router inside the process for hosts without a network listener.

mod app_state;
mod in_process_transport;
mod in_process_transport_error;
mod local_engine;
mod local_engine_error;
mod router;
mod secrets;

pub use app_state::AppState;
pub use in_process_transport::{InProcessTransport, ResponseHead};
pub use in_process_transport_error::InProcessTransportError;
pub use local_engine::LocalEngine;
pub use local_engine_error::LocalEngineError;
pub use router::router;
pub use secrets::Secrets;
