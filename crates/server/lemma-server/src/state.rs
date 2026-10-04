use std::sync::Arc;

use lemma_adapter::{DispatchProvider, Provider};
use lemma_agent_rpc::AgentRpc;
use lemma_auth_rpc::AuthRpc;
use lemma_conversation_rpc::ConversationRpc;
use lemma_provider_rpc::ProviderRpc;
use uuid::Uuid;

use crate::config::{Config, DatabaseBackend};

enum Backend {
    Postgres(sqlx::PgPool),
    Sqlite(sqlx::SqlitePool),
}

pub struct AppState {
    backend: Backend,
    pub auth: Arc<AuthRpc>,
    pub providers: Arc<ProviderRpc>,
    pub conversations: Arc<ConversationRpc>,
    pub agent: Arc<AgentRpc>,
}

impl AppState {
    pub async fn new(config: Config) -> Result<Self, Box<dyn std::error::Error>> {
        let provider: Arc<dyn Provider> = Arc::new(DispatchProvider::new());
        match config.database_backend()? {
            DatabaseBackend::Postgres => {
                let pool = lemma_db_pgsql::connect(&config.database_url).await?;
                lemma_db_pgsql::migrate(&pool).await?;
                let providers = Arc::new(lemma_db_pgsql::PgProviderStore::new(pool.clone()));
                Ok(Self {
                    auth: Arc::new(AuthRpc::new(
                        Arc::new(lemma_db_pgsql::PgAuthStore::new(pool.clone())),
                        config.jwt_secret.clone(),
                    )),
                    providers: Arc::new(ProviderRpc::new(
                        providers.clone(),
                        config.jwt_secret.clone(),
                        config.secret_key.clone(),
                    )),
                    conversations: Arc::new(ConversationRpc::new(
                        Arc::new(lemma_db_pgsql::PgConversationStore::new(pool.clone())),
                        config.jwt_secret.clone(),
                    )),
                    agent: Arc::new(AgentRpc::new(
                        {
                            let pool = pool.clone();
                            Arc::new(move |user_id: Uuid| {
                                Arc::new(lemma_db_pgsql::PgTraceStore::new(pool.clone(), user_id))
                                    as Arc<dyn lemma_session::TraceStore>
                            })
                        },
                        providers,
                        config.jwt_secret.clone(),
                        config.secret_key.clone(),
                        provider,
                    )),
                    backend: Backend::Postgres(pool),
                })
            }
            DatabaseBackend::Sqlite => {
                let pool = lemma_db_sqlite::connect(config.sqlite_path()?).await?;
                lemma_db_sqlite::migrate(&pool).await?;
                let providers = Arc::new(lemma_db_sqlite::SqliteProviderStore::new(pool.clone()));
                Ok(Self {
                    auth: Arc::new(AuthRpc::new(
                        Arc::new(lemma_db_sqlite::SqliteAuthStore::new(pool.clone())),
                        config.jwt_secret.clone(),
                    )),
                    providers: Arc::new(ProviderRpc::new(
                        providers.clone(),
                        config.jwt_secret.clone(),
                        config.secret_key.clone(),
                    )),
                    conversations: Arc::new(ConversationRpc::new(
                        Arc::new(lemma_db_sqlite::SqliteConversationStore::new(pool.clone())),
                        config.jwt_secret.clone(),
                    )),
                    agent: Arc::new(AgentRpc::new(
                        {
                            let pool = pool.clone();
                            Arc::new(move |user_id: Uuid| {
                                Arc::new(lemma_db_sqlite::SqliteTraceStore::new(
                                    pool.clone(),
                                    user_id,
                                ))
                                    as Arc<dyn lemma_session::TraceStore>
                            })
                        },
                        providers,
                        config.jwt_secret.clone(),
                        config.secret_key.clone(),
                        provider,
                    )),
                    backend: Backend::Sqlite(pool),
                })
            }
        }
    }

    pub async fn close(&self) {
        match &self.backend {
            Backend::Postgres(pool) => pool.close().await,
            Backend::Sqlite(pool) => pool.close().await,
        }
    }
}
