//! Provider domain: CRUD for user-configured model providers, API-key
//! sealing, and live model lists through a `lemma_model::Connector`, over
//! the providers table, which this crate defines and migrates.

mod entity;
mod migration;
mod provider_error;
mod provider_service;

pub use migration::migrations;
pub use provider_error::ProviderError;
pub use provider_service::{CreateInput, ProviderService, ProviderView, UpdateInput};
