//! `ProviderRpc` as a value hosts hold and log.

use std::sync::Arc;

use lemma_model::{Adapter, BoxEventStream, Connector, Endpoint, ModelError, ModelRequest};
use lemma_provider::ProviderService;
use lemma_provider_rpc::ProviderRpc;
use sea_orm::DatabaseConnection;

struct NoAdapter;

impl Adapter for NoAdapter {
    async fn stream(&self, _req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        Err(ModelError::new("no model".to_owned()))
    }
}

#[derive(Debug)]
struct NoConnector;

impl Connector for NoConnector {
    type Adapter = NoAdapter;

    fn connect(&self, _endpoint: Endpoint) -> NoAdapter {
        NoAdapter
    }

    async fn list_models(&self, _endpoint: Endpoint) -> Result<Vec<String>, ModelError> {
        Ok(Vec::new())
    }
}

#[test]
fn debug_output_never_reveals_the_signing_or_sealing_secret() {
    let domain = ProviderService::new(
        DatabaseConnection::default(),
        "sealing-secret".to_owned(),
        NoConnector,
    );
    let rpc = ProviderRpc::new(Arc::new(domain), "jwt-secret".to_owned());

    let debug = format!("{rpc:?}");

    assert!(
        debug.starts_with("ProviderRpc")
            && !debug.contains("jwt-secret")
            && !debug.contains("sealing-secret"),
        "{debug}"
    );
}
