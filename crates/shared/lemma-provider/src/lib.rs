//! Provider domain: CRUD for user-configured model providers, API-key
//! sealing, and live model lists through a `lemma_model::Connector`,
//! generic over a [`ProviderStore`] backend.

mod error;
mod record;
mod service;
mod store;

pub use error::ProviderError;
pub use record::{NewProvider, ProviderPatch, ProviderRecord};
pub use service::{CreateInput, ProviderService, ProviderView, UpdateInput};
pub use store::{BoxProviderFuture, ProviderStore};
