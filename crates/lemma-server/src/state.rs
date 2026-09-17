use std::sync::Arc;

use lemma_auth::AuthService;
use lemma_chat::ChatService;
use lemma_chat::adapter::{DispatchAdapter, LlmAdapter};
use lemma_conversations::ConversationService;
use lemma_providers::ProviderService;
use lemma_sync::SyncService;
use sqlx::PgPool;

use crate::config::Config;

pub struct AppState {
    pub pool: PgPool,
    pub auth: Arc<AuthService>,
    pub providers: Arc<ProviderService>,
    pub storage: Arc<lemma_archive::StorageService>,
    pub conversations: Arc<ConversationService<lemma_archive::DbArchiveSource>>,
    pub chat: Arc<ChatService>,
    pub sync: Arc<SyncService>,
}

impl AppState {
    pub async fn new(config: Config) -> Result<Self, Box<dyn std::error::Error>> {
        let pool = lemma_db::connect(&config.database_url).await?;
        lemma_db::migrate(&pool).await?;

        let adapter: Arc<dyn LlmAdapter> = Arc::new(DispatchAdapter::new());
        Ok(Self {
            auth: Arc::new(AuthService::new(pool.clone(), config.jwt_secret.clone())),
            providers: Arc::new(ProviderService::new(
                pool.clone(),
                config.jwt_secret.clone(),
                config.secret_key.clone(),
            )),
            storage: Arc::new(lemma_archive::StorageService::new(
                pool.clone(),
                config.jwt_secret.clone(),
                config.secret_key.clone(),
            )),
            conversations: Arc::new(ConversationService::new(
                pool.clone(),
                config.jwt_secret.clone(),
                lemma_archive::DbArchiveSource::new(pool.clone(), config.secret_key.clone()),
            )),
            chat: Arc::new(ChatService::new(
                pool.clone(),
                config.jwt_secret.clone(),
                config.secret_key.clone(),
                adapter,
            )),
            sync: Arc::new(SyncService::new(pool.clone(), config.jwt_secret.clone())),
            pool,
        })
    }
}
