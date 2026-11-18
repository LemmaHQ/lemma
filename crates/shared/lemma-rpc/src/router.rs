use std::path::PathBuf;
use std::sync::Arc;

use axum::Router;
use sqlx::SqlitePool;

use crate::app_state::AppState;

/// Builds the Connect router serving `AgentService`, `SessionService`, and
/// `ProviderService` over `db`. Provider API keys are sealed under a key
/// derived from `secret_key`; turns run tools in the session's directory,
/// or else in its workspace under `workspaces_dir`.
pub fn router(db: SqlitePool, secret_key: &str, workspaces_dir: PathBuf) -> Router {
    let state = AppState::new(db, secret_key, workspaces_dir);
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
