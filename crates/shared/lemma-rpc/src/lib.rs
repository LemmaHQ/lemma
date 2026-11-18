//! The Connect service handlers for `ProviderService`, `SessionService`, and
//! `AgentService`, assembled into one router over a database.

mod agent_event;
mod agent_rpc;
mod app_state;
mod parse_id;
mod provider_mapping;
mod provider_rpc;
mod router;
mod session_rpc;

pub use router::router;
