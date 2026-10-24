use std::sync::Arc;

use axum::Router;
use lemma_auth::AuthStore;
use lemma_conversation::ConversationStore;
use lemma_provider::ProviderStore;

use crate::app_state::AppState;

/// Mounts each Connect service under its `/lemma.v1.<Service>/` path.
pub fn router<A: AuthStore, S: ConversationStore, P: ProviderStore>(
    state: AppState<A, S, P>,
) -> Router {
    let agent = connectrpc::Router::new()
        .add_service(Arc::new(state.agent))
        .into_axum_service();
    let auth = connectrpc::Router::new()
        .add_service(Arc::new(state.auth))
        .into_axum_service();
    let conversations = connectrpc::Router::new()
        .add_service(Arc::new(state.conversations))
        .into_axum_service();
    let providers = connectrpc::Router::new()
        .add_service(Arc::new(state.providers))
        .into_axum_service();
    Router::new()
        .route_service("/lemma.v1.AgentService/{*path}", agent)
        .route_service("/lemma.v1.AuthService/{*path}", auth)
        .route_service("/lemma.v1.ConversationService/{*path}", conversations)
        .route_service("/lemma.v1.ProviderService/{*path}", providers)
}
