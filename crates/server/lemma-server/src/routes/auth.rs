use std::sync::Arc;

use axum::Router;
use lemma_auth_rpc::AuthRpc;

pub fn router(service: Arc<AuthRpc>) -> Router {
    let connect = connectrpc::Router::new()
        .add_service(service)
        .into_axum_service();
    Router::new().route_service("/lemma.v1.AuthService/{*path}", connect)
}
