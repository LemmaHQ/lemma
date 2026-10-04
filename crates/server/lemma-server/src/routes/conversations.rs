use std::sync::Arc;

use axum::Router;
use lemma_conversation_rpc::ConversationRpc;

pub fn router(service: Arc<ConversationRpc>) -> Router {
    let connect = connectrpc::Router::new()
        .add_service(service)
        .into_axum_service();
    Router::new().route_service("/lemma.v1.ConversationService/{*path}", connect)
}
