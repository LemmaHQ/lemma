//! Provider domain: CRUD for user-configured LLM providers and live model
//! list fetching.

mod models;
mod service;

pub use models::fetch_models;
pub use service::{ProviderService, kind_to_proto};
