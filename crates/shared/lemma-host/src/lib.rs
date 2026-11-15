//! Assembles the Connect services into one router over a database, opens
//! the local engine from its data directory, and serves the router inside
//! the process for hosts without a network listener.

mod agent_event;
mod agent_rpc;
mod app_state;
mod in_process_transport;
mod in_process_transport_error;
mod local_engine;
mod local_engine_error;
mod parse_id;
mod provider_mapping;
mod provider_rpc;
mod router;
mod secrets;
mod session_rpc;

pub use app_state::AppState;
pub use in_process_transport::{InProcessTransport, ResponseHead};
pub use in_process_transport_error::InProcessTransportError;
pub use local_engine::LocalEngine;
pub use local_engine_error::LocalEngineError;
pub use secrets::Secrets;
