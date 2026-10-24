use std::fs;
use std::path::Path;

use axum::Router;
use lemma_db_sqlite::{SqliteAuthStore, SqliteConversationStore, SqliteProviderStore};
use sqlx::SqlitePool;

use crate::app_state::AppState;
use crate::local_engine_error::LocalEngineError;
use crate::router;
use crate::secrets::Secrets;

/// The desktop engine: the Connect services over one SQLite database, with
/// the secrets, the database, and the workspaces under one data directory.
#[derive(Debug)]
pub struct LocalEngine {
    router: Router,
    pool: SqlitePool,
}

impl LocalEngine {
    /// Opens the engine over `data_dir`: loads `secrets.json`, generating it
    /// on first run, and opens and migrates `lemma.db`. Turns run workspace
    /// tools under `workspaces/`.
    ///
    /// # Errors
    ///
    /// [`LocalEngineError`] naming the startup step that failed.
    pub async fn open(data_dir: &Path) -> Result<Self, LocalEngineError> {
        let secrets = load_or_create_secrets(data_dir)?;
        let pool = lemma_db_sqlite::connect(data_dir.join("lemma.db"))
            .await
            .map_err(LocalEngineError::Database)?;
        lemma_db_sqlite::migrate(&pool)
            .await
            .map_err(LocalEngineError::Migration)?;
        let auth_store = SqliteAuthStore::new(pool.clone());
        let state = AppState::new(
            auth_store,
            SqliteConversationStore::new(pool.clone()),
            SqliteProviderStore::new(pool.clone()),
            secrets,
            Some(data_dir.join("workspaces")),
        );
        Ok(Self {
            router: router::router(state),
            pool,
        })
    }

    /// The Connect router serving the engine's services.
    pub fn router(&self) -> Router {
        self.router.clone()
    }

    /// Closes the database pool; call it after the host stops serving.
    pub async fn close(self) {
        self.pool.close().await;
    }
}

/// Loads the secrets from `secrets.json` inside the data directory,
/// generating and persisting them on first run.
fn load_or_create_secrets(data_dir: &Path) -> Result<Secrets, LocalEngineError> {
    use rand::RngExt;

    let path = data_dir.join("secrets.json");
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw)
            .map_err(|e| LocalEngineError::Secrets(format!("secrets.json: {e}"))),
        Err(_) => {
            let secrets = Secrets {
                jwt_secret: hex::encode(rand::rng().random::<[u8; 32]>()),
                secret_key: hex::encode(rand::rng().random::<[u8; 32]>()),
            };
            fs::create_dir_all(data_dir).map_err(|e| {
                LocalEngineError::Secrets(format!("create {}: {e}", data_dir.display()))
            })?;
            let json = serde_json::to_string(&secrets)
                .map_err(|e| LocalEngineError::Secrets(format!("secrets.json: {e}")))?;
            fs::write(&path, json)
                .map_err(|e| LocalEngineError::Secrets(format!("write {}: {e}", path.display())))?;
            Ok(secrets)
        }
    }
}
