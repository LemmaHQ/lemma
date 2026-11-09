use lemma_proto::lemma::v1::Provider;

/// A model together with the provider that serves it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModelChoice {
    /// The provider identifier.
    pub provider_id: String,
    /// The provider's model identifier.
    pub model: String,
}

/// Lists every model of every enabled provider, preserving provider and model order.
#[must_use]
pub fn model_choices(providers: &[Provider]) -> Vec<ModelChoice> {
    let mut choices = Vec::new();
    for provider in providers {
        if !provider.enabled {
            continue;
        }
        for model in &provider.models {
            choices.push(ModelChoice {
                provider_id: provider.id.clone(),
                model: model.clone(),
            });
        }
    }
    choices
}

/// Returns the stored choice while offered, otherwise the first available choice.
#[must_use]
pub fn resolve_model(stored: Option<&ModelChoice>, choices: &[ModelChoice]) -> Option<ModelChoice> {
    if let Some(stored) = stored
        && choices.iter().any(|choice| choice == stored)
    {
        return Some(stored.clone());
    }
    choices.first().cloned()
}
