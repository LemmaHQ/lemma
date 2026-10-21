use std::sync::Arc;

use lemma_adapter::{HttpConnector, ReqwestTransport};
use lemma_agent::Agent;
use lemma_agent_rpc::AgentRpc;
use lemma_auth_rpc::AuthRpc;
use lemma_conversation::ConversationStore;
use lemma_conversation_rpc::ConversationRpc;
use lemma_model::Connector;
use lemma_provider::{ProviderService, ProviderStore};
use lemma_provider_rpc::ProviderRpc;

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
        match config.database_backend()? {
            DatabaseBackend::Postgres => {
                let pool = lemma_db_pgsql::connect(&config.database_url).await?;
                lemma_db_pgsql::migrate(&pool).await?;
                let conversations: Arc<dyn ConversationStore> =
                    Arc::new(lemma_db_pgsql::PgConversationStore::new(pool.clone()));
                let (providers, agent) = Self::domain(
                    Arc::new(lemma_db_pgsql::PgProviderStore::new(pool.clone())),
                    config.secret_key.clone(),
                    Arc::clone(&conversations),
                    None,
                );
                Ok(Self {
                    auth: Arc::new(AuthRpc::new(
                        Arc::new(lemma_db_pgsql::PgAuthStore::new(pool.clone())),
                        config.jwt_secret.clone(),
                    )),
                    providers: Arc::new(ProviderRpc::new(providers, config.jwt_secret.clone())),
                    conversations: Arc::new(ConversationRpc::new(
                        conversations,
                        config.jwt_secret.clone(),
                    )),
                    agent: Arc::new(AgentRpc::new(agent, config.jwt_secret.clone())),
                    backend: Backend::Postgres(pool),
                })
            }
            DatabaseBackend::Sqlite => {
                let pool = lemma_db_sqlite::connect(config.sqlite_path()?).await?;
                lemma_db_sqlite::migrate(&pool).await?;
                Self::sqlite_state(pool, config.jwt_secret, config.secret_key, None)
            }
        }
    }

    /// The provider domain and the agent over one connector.
    fn domain(
        store: Arc<dyn ProviderStore>,
        secret_key: Arc<str>,
        conversations: Arc<dyn ConversationStore>,
        workspaces_dir: Option<std::path::PathBuf>,
    ) -> (Arc<ProviderService>, Arc<Agent>) {
        let connector: Arc<dyn Connector> =
            Arc::new(HttpConnector::new(Arc::new(ReqwestTransport::new())));
        let providers = Arc::new(ProviderService::new(
            store,
            Some(secret_key),
            Arc::clone(&connector),
        ));
        let agent = Arc::new(Agent::new(
            conversations,
            Arc::clone(&providers),
            connector,
            workspaces_dir,
        ));
        (providers, agent)
    }

    /// Embedded local engine: SQLite and engine-managed secrets under one
    /// data directory, serving loopback only, with the default account
    /// provisioned.
    pub async fn local(data_dir: &std::path::Path) -> Result<Self, Box<dyn std::error::Error>> {
        let secrets = crate::local::load_or_create_secrets(data_dir)?;
        let pool = lemma_db_sqlite::connect(crate::local::database_path(data_dir)).await?;
        lemma_db_sqlite::migrate(&pool).await?;
        let jwt_secret: Arc<str> = Arc::from(secrets.jwt_secret.as_str());
        let auth_store = Arc::new(lemma_db_sqlite::SqliteAuthStore::new(pool.clone()));
        let auth = lemma_auth::AuthService::new(auth_store.clone(), Arc::clone(&jwt_secret));
        crate::local::ensure_default_account(auth_store.as_ref(), &auth).await?;
        Self::sqlite_state(
            pool,
            jwt_secret,
            Arc::from(secrets.secret_key.as_str()),
            Some(data_dir.join("workspaces")),
        )
    }

    /// Wires all four services over the SQLite backend.
    fn sqlite_state(
        pool: sqlx::SqlitePool,
        jwt_secret: Arc<str>,
        secret_key: Arc<str>,
        workspaces_dir: Option<std::path::PathBuf>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let auth_store: Arc<dyn lemma_auth::AuthStore> =
            Arc::new(lemma_db_sqlite::SqliteAuthStore::new(pool.clone()));
        let conversations: Arc<dyn ConversationStore> =
            Arc::new(lemma_db_sqlite::SqliteConversationStore::new(pool.clone()));
        let (providers, agent) = Self::domain(
            Arc::new(lemma_db_sqlite::SqliteProviderStore::new(pool.clone())),
            secret_key,
            Arc::clone(&conversations),
            workspaces_dir,
        );
        Ok(Self {
            auth: Arc::new(AuthRpc::new(auth_store, jwt_secret.clone())),
            providers: Arc::new(ProviderRpc::new(providers, jwt_secret.clone())),
            conversations: Arc::new(ConversationRpc::new(conversations, jwt_secret.clone())),
            agent: Arc::new(AgentRpc::new(agent, jwt_secret)),
            backend: Backend::Sqlite(pool),
        })
    }

    pub async fn close(&self) {
        match &self.backend {
            Backend::Postgres(pool) => pool.close().await,
            Backend::Sqlite(pool) => pool.close().await,
        }
    }
}
