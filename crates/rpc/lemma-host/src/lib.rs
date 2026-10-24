//! Assembles the four Connect services into one router over a storage
//! backend, and opens the local engine from its data directory.

mod app_state;
mod local_engine;
mod local_engine_error;
mod router;
mod secrets;

pub use app_state::AppState;
pub use local_engine::LocalEngine;
pub use local_engine_error::LocalEngineError;
pub use router::router;
pub use secrets::Secrets;
