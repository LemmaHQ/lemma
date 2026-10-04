//! Provider domain: CRUD for user-configured LLM providers and live model
//! list fetching, generic over a [`ProviderStore`] backend.

mod error;
mod kind;
mod models;
mod record;
mod service;
mod store;

pub use error::ProviderError;
pub use kind::ProviderKind;
pub use models::fetch_models;
pub use record::{NewProvider, ProviderPatch, ProviderRecord};
pub use service::{CreateInput, ProviderService, ProviderView, UpdateInput};
pub use store::{BoxProviderFuture, ProviderStore};
