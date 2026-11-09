//! Provider calls against a local engine and an OpenAI-compatible vendor on
//! the loopback interface.

mod common;

use common::{Engine, TestResult, vendor};
use lemma_proto::lemma::v1::{CheckProviderRequest, FetchModelsRequest, UpdateProviderRequest};

#[tokio::test]
async fn providers_are_created_checked_updated_and_deleted() -> TestResult {
    let engine = Engine::open().await?;
    let (client, _) = engine.signed_up("ada").await?;
    let provider = client.create_provider(vendor().await?).await?;
    assert_eq!(provider.name, "Vendor", "created");

    let models = client
        .fetch_models(FetchModelsRequest {
            id: provider.id.clone(),
            ..Default::default()
        })
        .await?;
    assert_eq!(models, ["answer", "wait"], "model list from the vendor");

    let check = |model: &str| CheckProviderRequest {
        id: provider.id.clone(),
        model: model.to_owned(),
        ..Default::default()
    };
    assert_eq!(
        client.check_provider(check("answer")).await?,
        None,
        "answering model"
    );
    assert!(
        client.check_provider(check("broken")).await?.is_some(),
        "failing model reports its error"
    );

    let updated = client
        .update_provider(UpdateProviderRequest {
            id: provider.id.clone(),
            name: Some("Renamed".to_owned()),
            ..Default::default()
        })
        .await?;
    assert_eq!(updated.name, "Renamed", "updated");
    assert_eq!(client.list_providers().await?.len(), 1, "listed");
    client.delete_provider(&provider.id).await?;
    assert!(client.list_providers().await?.is_empty(), "deleted");
    Ok(())
}
