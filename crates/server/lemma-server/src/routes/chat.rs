use std::sync::Arc;

use axum::Router;
use lemma_chat::ChatService;

pub fn router(service: Arc<ChatService>) -> Router {
    let connect = connectrpc::Router::new()
        .add_service(service)
        .into_axum_service();
    Router::new().route_service("/lemma.v1.ChatService/{*path}", connect)
}
