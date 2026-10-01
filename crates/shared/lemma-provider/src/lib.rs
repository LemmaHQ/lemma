//! Provider domain: CRUD for user-configured LLM providers and live model
//! list fetching, generic over a [`ProviderStore`] backend.

mod error;
mod models;
mod record;
mod service;
mod store;

pub use error::ProviderError;
pub use models::fetch_models;
pub use record::{NewProvider, ProviderPatch, ProviderRecord};
pub use service::{
    CreateInput, ProviderService, ProviderView, UpdateInput, kind_to_proto, kind_to_str,
};
pub use store::{BoxProviderFuture, ProviderStore};
