use std::sync::Arc;

use lemma_adapter::{DispatchProvider, Provider};
use lemma_auth::AuthService;
use lemma_chat::ChatService;
use lemma_conversation::ConversationService;
use lemma_provider::ProviderService;
use sqlx::PgPool;

use crate::config::Config;

pub struct AppState {
    pub pool: PgPool,
    pub auth: Arc<AuthService>,
    pub providers: Arc<ProviderService>,
    pub conversations: Arc<ConversationService>,
    pub chat: Arc<ChatService>,
}

impl AppState {
    pub async fn new(config: Config) -> Result<Self, Box<dyn std::error::Error>> {
        let pool = lemma_db_pgsql::connect(&config.database_url).await?;
        lemma_db_pgsql::migrate(&pool).await?;

        let provider: Arc<dyn Provider> = Arc::new(DispatchProvider::new());
        Ok(Self {
            auth: Arc::new(AuthService::new(pool.clone(), config.jwt_secret.clone())),
            providers: Arc::new(ProviderService::new(
                pool.clone(),
                config.jwt_secret.clone(),
                config.secret_key.clone(),
            )),
            conversations: Arc::new(ConversationService::new(
                pool.clone(),
                config.jwt_secret.clone(),
            )),
            chat: Arc::new(ChatService::new(
                pool.clone(),
                config.jwt_secret.clone(),
                config.secret_key.clone(),
                provider,
            )),
            pool,
        })
    }
}
