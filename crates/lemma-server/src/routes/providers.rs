use std::sync::Arc;

use axum::Router;
use lemma_providers::ProviderService;

pub fn router(service: Arc<ProviderService>) -> Router {
    let connect = connectrpc::Router::new()
        .add_service(service)
        .into_axum_service();
    Router::new().route_service("/lemma.v1.ProviderService/{*path}", connect)
}
