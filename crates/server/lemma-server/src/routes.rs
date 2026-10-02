mod agent;
mod auth;
mod conversations;
mod providers;

use axum::Router;

use crate::state::AppState;

pub fn router(state: &AppState) -> Router {
    Router::new()
        .merge(agent::router(state.agent.clone()))
        .merge(auth::router(state.auth.clone()))
        .merge(conversations::router(state.conversations.clone()))
        .merge(providers::router(state.providers.clone()))
}
