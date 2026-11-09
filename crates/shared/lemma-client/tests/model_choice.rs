//! Behavioral tests for model availability and selection fallback.

use lemma_client::{ModelChoice, model_choices, resolve_model};
use lemma_proto::lemma::v1::Provider;

fn provider(id: &str, enabled: bool, models: &[&str]) -> Provider {
    Provider {
        id: id.to_owned(),
        enabled,
        models: models.iter().map(|model| (*model).to_owned()).collect(),
        ..Default::default()
    }
}

fn choice(provider_id: &str, model: &str) -> ModelChoice {
    ModelChoice {
        provider_id: provider_id.to_owned(),
        model: model.to_owned(),
    }
}

#[test]
fn choices_include_enabled_providers_in_order() {
    let providers = vec![
        provider("disabled", false, &["hidden"]),
        provider("empty", true, &[]),
        provider("first", true, &["one", "two"]),
        provider("second", true, &["three"]),
    ];
    assert_eq!(
        model_choices(&providers),
        [
            choice("first", "one"),
            choice("first", "two"),
            choice("second", "three"),
        ],
        "enabled providers and model order retained"
    );
}

#[test]
fn resolution_keeps_offered_storage_and_otherwise_falls_back() {
    let choices = [choice("first", "one"), choice("second", "two")];
    let stored = choice("second", "two");
    assert_eq!(
        resolve_model(Some(&stored), &choices),
        Some(stored),
        "offered stored choice retained"
    );
    let unavailable = choice("gone", "old");
    assert_eq!(
        resolve_model(Some(&unavailable), &choices),
        Some(choice("first", "one")),
        "unavailable storage falls back to first"
    );
    assert_eq!(
        resolve_model(None, &choices),
        Some(choice("first", "one")),
        "missing storage falls back to first"
    );
    assert_eq!(
        resolve_model(Some(&unavailable), &[]),
        None,
        "no choices resolve to none"
    );
    assert_eq!(model_choices(&[]), [], "no providers produce no choices");
}
