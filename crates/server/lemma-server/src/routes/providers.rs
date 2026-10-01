use std::sync::Arc;

use axum::Router;
use lemma_provider_rpc::ProviderRpc;

pub fn router(service: Arc<ProviderRpc>) -> Router {
    let connect = connectrpc::Router::new()
        .add_service(service)
        .into_axum_service();
    Router::new().route_service("/lemma.v1.ProviderService/{*path}", connect)
}
