mod auth;
mod chat;
mod conversations;
mod providers;
mod storage;
mod sync;

use axum::Router;

use crate::state::AppState;

pub fn router(state: &AppState) -> Router {
    Router::new()
        .merge(auth::router(state.auth.clone()))
        .merge(chat::router(state.chat.clone()))
        .merge(conversations::router(state.conversations.clone()))
        .merge(providers::router(state.providers.clone()))
        .merge(storage::router(state.storage.clone()))
        .merge(sync::router(state.sync.clone()))
}
