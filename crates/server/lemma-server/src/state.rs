use std::sync::Arc;

use lemma_adapter::{HttpConnector, ReqwestTransport};
use lemma_agent::{Agent, TraceStoreFactory};
use lemma_agent_rpc::AgentRpc;
use lemma_auth_rpc::AuthRpc;
use lemma_conversation_rpc::ConversationRpc;
use lemma_model::Connector;
use lemma_provider::{ProviderService, ProviderStore};
use lemma_provider_rpc::ProviderRpc;
use uuid::Uuid;

use crate::config::{Config, DatabaseBackend};

enum Backend {
    Postgres(sqlx::PgPool),
    Sqlite(sqlx::SqlitePool),
    Local(sqlx::SqlitePool),
}

pub struct AppState {
    backend: Backend,
    pub auth: Arc<AuthRpc>,
    pub providers: Arc<ProviderRpc>,
    pub conversations: Arc<ConversationRpc>,
    pub agent: Arc<AgentRpc>,
    /// Local mode only: the store behind `auth`, used to provision the
    /// default account. `None` in server mode.
    pub local_auth_store: Option<Arc<dyn lemma_auth::AuthStore>>,
    /// Local mode only: engine-managed signing secrets.
    pub local_secrets: Option<crate::local::LocalSecrets>,
}

impl AppState {
    pub async fn new(config: Config) -> Result<Self, Box<dyn std::error::Error>> {
        match config.database_backend()? {
            DatabaseBackend::Postgres => {
                let pool = lemma_db_pgsql::connect(&config.database_url).await?;
                lemma_db_pgsql::migrate(&pool).await?;
                let traces: TraceStoreFactory = {
                    let pool = pool.clone();
                    Arc::new(move |user_id: Uuid| {
                        Arc::new(lemma_db_pgsql::PgTraceStore::new(pool.clone(), user_id))
                            as Arc<dyn lemma_session::TraceStore>
                    })
                };
                let (providers, agent) = Self::domain(
                    Arc::new(lemma_db_pgsql::PgProviderStore::new(pool.clone())),
                    config.secret_key.clone(),
                    traces,
                    None,
                );
                Ok(Self {
                    auth: Arc::new(AuthRpc::new(
                        Arc::new(lemma_db_pgsql::PgAuthStore::new(pool.clone())),
                        config.jwt_secret.clone(),
                    )),
                    providers: Arc::new(ProviderRpc::new(providers, config.jwt_secret.clone())),
                    conversations: Arc::new(ConversationRpc::new(
                        Arc::new(lemma_db_pgsql::PgConversationStore::new(pool.clone())),
                        config.jwt_secret.clone(),
                    )),
                    agent: Arc::new(AgentRpc::new(agent, config.jwt_secret.clone())),
                    local_auth_store: None,
                    local_secrets: None,
                    backend: Backend::Postgres(pool),
                })
            }
            DatabaseBackend::Sqlite => {
                let pool = lemma_db_sqlite::connect(config.sqlite_path()?).await?;
                lemma_db_sqlite::migrate(&pool).await?;
                Self::sqlite_state(pool, config.jwt_secret, config.secret_key, false, None)
            }
        }
    }

    /// The provider domain and the agent over one connector.
    fn domain(
        store: Arc<dyn ProviderStore>,
        secret_key: Arc<str>,
        traces: TraceStoreFactory,
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
            traces,
            Arc::clone(&providers),
            connector,
            workspaces_dir,
        ));
        (providers, agent)
    }

    /// Embedded local engine: SQLite and engine-managed secrets under one
    /// data directory, serving loopback only.
    pub async fn local(data_dir: &std::path::Path) -> Result<Self, Box<dyn std::error::Error>> {
        let secrets = crate::local::load_or_create_secrets(data_dir)?;
        let pool = lemma_db_sqlite::connect(crate::local::database_path(data_dir)).await?;
        lemma_db_sqlite::migrate(&pool).await?;
        let mut state = Self::sqlite_state(
            pool,
            Arc::from(secrets.jwt_secret.as_str()),
            Arc::from(secrets.secret_key.as_str()),
            true,
            Some(data_dir.join("workspaces")),
        )?;
        state.local_secrets = Some(secrets);
        Ok(state)
    }

    /// Wires all four services over the SQLite backend. `local` keeps the
    /// auth store reachable for default-account provisioning.
    fn sqlite_state(
        pool: sqlx::SqlitePool,
        jwt_secret: Arc<str>,
        secret_key: Arc<str>,
        local: bool,
        workspaces_dir: Option<std::path::PathBuf>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let auth_store: Arc<dyn lemma_auth::AuthStore> =
            Arc::new(lemma_db_sqlite::SqliteAuthStore::new(pool.clone()));
        let traces: TraceStoreFactory = {
            let pool = pool.clone();
            Arc::new(move |user_id: Uuid| {
                Arc::new(lemma_db_sqlite::SqliteTraceStore::new(
                    pool.clone(),
                    user_id,
                )) as Arc<dyn lemma_session::TraceStore>
            })
        };
        let (providers, agent) = Self::domain(
            Arc::new(lemma_db_sqlite::SqliteProviderStore::new(pool.clone())),
            secret_key,
            traces,
            workspaces_dir,
        );
        Ok(Self {
            auth: Arc::new(AuthRpc::new(auth_store.clone(), jwt_secret.clone())),
            providers: Arc::new(ProviderRpc::new(providers, jwt_secret.clone())),
            conversations: Arc::new(ConversationRpc::new(
                Arc::new(lemma_db_sqlite::SqliteConversationStore::new(pool.clone())),
                jwt_secret.clone(),
            )),
            agent: Arc::new(AgentRpc::new(agent, jwt_secret)),
            local_auth_store: local.then_some(auth_store),
            local_secrets: None,
            backend: if local {
                Backend::Local(pool)
            } else {
                Backend::Sqlite(pool)
            },
        })
    }

    pub async fn close(&self) {
        match &self.backend {
            Backend::Postgres(pool) => pool.close().await,
            Backend::Sqlite(pool) | Backend::Local(pool) => pool.close().await,
        }
    }
}
