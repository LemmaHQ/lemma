use std::sync::Arc;

use lemma_adapter::{DispatchProvider, Provider};
use lemma_agent_rpc::AgentRpc;
use lemma_auth::AuthService;
use lemma_conversation::ConversationService;
use lemma_provider_rpc::ProviderRpc;
use sqlx::PgPool;

use crate::config::Config;

pub struct AppState {
    pub pool: PgPool,
    pub auth: Arc<AuthService>,
    pub providers: Arc<ProviderRpc>,
    pub conversations: Arc<ConversationService>,
    pub agent: Arc<AgentRpc>,
}

impl AppState {
    pub async fn new(config: Config) -> Result<Self, Box<dyn std::error::Error>> {
        let pool = lemma_db_pgsql::connect(&config.database_url).await?;
        lemma_db_pgsql::migrate(&pool).await?;

        let provider: Arc<dyn Provider> = Arc::new(DispatchProvider::new());
        Ok(Self {
            auth: Arc::new(AuthService::new(pool.clone(), config.jwt_secret.clone())),
            providers: Arc::new(ProviderRpc::new(
                pool.clone(),
                config.jwt_secret.clone(),
                config.secret_key.clone(),
            )),
            conversations: Arc::new(ConversationService::new(
                pool.clone(),
                config.jwt_secret.clone(),
            )),
            agent: Arc::new(AgentRpc::new(
                pool.clone(),
                config.jwt_secret.clone(),
                config.secret_key.clone(),
                provider,
            )),
            pool,
        })
    }
}
