use std::sync::Arc;

use axum::Router;

use crate::app_state::AppState;

/// Mounts each Connect service under its `/lemma.v1.<Service>/` path.
pub fn router(state: AppState) -> Router {
    let agent = connectrpc::Router::new()
        .add_service(Arc::new(state.agent))
        .into_axum_service();
    let auth = connectrpc::Router::new()
        .add_service(Arc::new(state.auth))
        .into_axum_service();
    let sessions = connectrpc::Router::new()
        .add_service(Arc::new(state.sessions))
        .into_axum_service();
    let providers = connectrpc::Router::new()
        .add_service(Arc::new(state.providers))
        .into_axum_service();
    let system = connectrpc::Router::new()
        .add_service(Arc::new(state.system))
        .into_axum_service();
    Router::new()
        .route_service("/lemma.v1.AgentService/{*path}", agent)
        .route_service("/lemma.v1.AuthService/{*path}", auth)
        .route_service("/lemma.v1.SessionService/{*path}", sessions)
        .route_service("/lemma.v1.ProviderService/{*path}", providers)
        .route_service("/lemma.v1.SystemService/{*path}", system)
}
