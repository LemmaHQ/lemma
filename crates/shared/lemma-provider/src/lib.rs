//! Predefined and custom provider configuration, API-key sealing, turn
//! binding, and live model lists through a `lemma_model::Connector`.

mod entity;
mod migration;
mod preset;
mod provider_error;
mod provider_service;

pub use migration::migrations;
pub use provider_error::ProviderError;
pub use provider_service::{
    CreateCustomInput, CustomProviderView, PredefinedProviderView, ProviderBinding, ProviderModel,
    ProviderService, ProviderView, UpdateCustomInput, UpdatePredefinedInput, UpdateWebInput,
    WebBackend, WebFunction, WebProviderKind, WebProviderView,
};
