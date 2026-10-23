//! Provider domain: CRUD for user-configured model providers, API-key
//! sealing, and live model lists through a `lemma_model::Connector`,
//! generic over a [`ProviderStore`] backend.

mod provider_error;
mod provider_service;
mod provider_store;
mod record;

pub use provider_error::ProviderError;
pub use provider_service::{CreateInput, ProviderService, ProviderView, UpdateInput};
pub use provider_store::ProviderStore;
pub use record::{NewProvider, ProviderPatch, ProviderRecord};
