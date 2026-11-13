use std::fs;
use std::path::Path;

use axum::Router;
use sqlx::SqlitePool;

use crate::app_state::AppState;
use crate::local_engine_error::LocalEngineError;
use crate::secrets::Secrets;
use crate::{database, router};

/// The local engine: the Connect services over one SQLite database, with
/// the secrets, the database, and the workspaces under one data directory.
#[derive(Debug)]
pub struct LocalEngine {
    router: Router,
    db: SqlitePool,
}

impl LocalEngine {
    /// Opens the engine over `data_dir`: loads `secrets.json`, generating it
    /// on first run, and opens and migrates `lemma.db`. Turns run tools in
    /// the session's directory, or else in its workspace under `workspaces/`.
    ///
    /// # Errors
    ///
    /// [`LocalEngineError`] naming the startup step that failed.
    pub async fn open(data_dir: &Path) -> Result<Self, LocalEngineError> {
        let secrets = load_or_create_secrets(data_dir)?;
        let db = database::connect(&data_dir.join("lemma.db"))
            .await
            .map_err(LocalEngineError::Database)?;
        database::migrate(&db)
            .await
            .map_err(LocalEngineError::Migration)?;
        let state = AppState::new(db.clone(), secrets, data_dir.join("workspaces"));
        Ok(Self {
            router: router::router(state),
            db,
        })
    }

    /// The Connect router serving the engine's services.
    pub fn router(&self) -> Router {
        self.router.clone()
    }

    /// Closes the database pool; call it after the host stops serving.
    pub async fn close(self) {
        self.db.close().await;
    }
}

/// Loads the secrets from `secrets.json` inside the data directory,
/// generating and persisting them on first run.
fn load_or_create_secrets(data_dir: &Path) -> Result<Secrets, LocalEngineError> {
    use rand::RngExt;

    let path = data_dir.join("secrets.json");
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).map_err(LocalEngineError::SecretsJson),
        Err(_) => {
            let secrets = Secrets {
                secret_key: hex::encode(rand::rng().random::<[u8; 32]>()),
            };
            fs::create_dir_all(data_dir).map_err(|e| {
                LocalEngineError::Secrets(format!("create {}: {e}", data_dir.display()))
            })?;
            let json = serde_json::to_string(&secrets).map_err(LocalEngineError::SecretsJson)?;
            fs::write(&path, json)
                .map_err(|e| LocalEngineError::Secrets(format!("write {}: {e}", path.display())))?;
            Ok(secrets)
        }
    }
}
