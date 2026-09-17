use std::sync::Arc;

use axum::Router;
use lemma_archive::StorageService;

pub fn router(service: Arc<StorageService>) -> Router {
    let connect = connectrpc::Router::new()
        .add_service(service)
        .into_axum_service();
    Router::new().route_service("/lemma.v1.StorageService/{*path}", connect)
}
