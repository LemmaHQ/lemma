use std::sync::Arc;

use axum::Router;
use lemma_agent_rpc::AgentRpc;

pub fn router(service: Arc<AgentRpc>) -> Router {
    let connect = connectrpc::Router::new()
        .add_service(service)
        .into_axum_service();
    Router::new().route_service("/lemma.v1.AgentService/{*path}", connect)
}
