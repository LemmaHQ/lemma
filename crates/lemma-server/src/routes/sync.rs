use std::sync::Arc;

use axum::Router;
use lemma_sync::SyncService;

pub fn router(service: Arc<SyncService>) -> Router {
    let connect = connectrpc::Router::new()
        .add_service(service)
        .into_axum_service();
    Router::new().route_service("/lemma.v1.SyncService/{*path}", connect)
}
