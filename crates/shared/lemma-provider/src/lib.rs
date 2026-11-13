//! Predefined and custom provider configuration, API-key sealing, turn
//! binding, and live model lists through a `lemma_model::Connector`.

mod preset;
mod provider_error;
mod provider_model;
mod provider_row;
mod provider_service;
mod web_provider_kind;

pub use provider_error::ProviderError;
pub use provider_model::ProviderModel;
pub use provider_service::{
    CreateCustomInput, CustomProviderView, PredefinedProviderView, ProviderBinding,
    ProviderService, ProviderView, UpdateCustomInput, UpdatePredefinedInput, UpdateWebInput,
    WebBackend, WebFunction, WebProviderView,
};
pub use web_provider_kind::WebProviderKind;
