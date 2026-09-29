use std::sync::Arc;

use axum::Router;
use lemma_conversations::ConversationService;

pub fn router(service: Arc<ConversationService>) -> Router {
    let connect = connectrpc::Router::new()
        .add_service(service)
        .into_axum_service();
    Router::new().route_service("/lemma.v1.ConversationService/{*path}", connect)
}
