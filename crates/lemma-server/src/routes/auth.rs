use std::sync::Arc;

use axum::Router;
use lemma_auth::AuthService;

pub fn router(service: Arc<AuthService>) -> Router {
    let connect = connectrpc::Router::new()
        .add_service(service)
        .into_axum_service();
    Router::new().route_service("/lemma.v1.AuthService/{*path}", connect)
}
