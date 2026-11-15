use std::sync::Arc;

use axum::Router;

use crate::app_state::AppState;

pub(crate) fn router(state: AppState) -> Router {
    let agent = connectrpc::Router::new()
        .add_service(Arc::new(state.agent))
        .into_axum_service();
    let sessions = connectrpc::Router::new()
        .add_service(Arc::new(state.sessions))
        .into_axum_service();
    let providers = connectrpc::Router::new()
        .add_service(Arc::new(state.providers))
        .into_axum_service();
    Router::new()
        .route_service("/lemma.v1.AgentService/{*path}", agent)
        .route_service("/lemma.v1.SessionService/{*path}", sessions)
        .route_service("/lemma.v1.ProviderService/{*path}", providers)
}
