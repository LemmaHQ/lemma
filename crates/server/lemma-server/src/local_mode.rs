//! Local engine mode: an embedded desktop engine. The SQLite database,
//! the signing secrets, and a default local account all live under a
//! single data directory `LEMMA_DATA_DIR`, served on loopback with an
//! ephemeral port. Readiness and the default account credentials are
//! announced on stdout.

use std::error::Error;
use std::path::{Path, PathBuf};
use std::{env, fs};

use lemma_auth::local::{DEFAULT_EMAIL, DEFAULT_PASSWORD, DEFAULT_USERNAME};
use lemma_auth::{AuthService, AuthStore};
use lemma_db_sqlite::{SqliteAuthStore, SqliteConversationStore, SqliteProviderStore};
use serde::Serialize;
use tokio::io;
use tokio::net::TcpListener;

use crate::app_state::AppState;
use crate::secrets::Secrets;
use crate::{http_server, routes};

/// Startup handshake printed to stdout so the Electron shell can pick up
/// the port and the default account's credentials.
#[derive(Debug, Clone, Serialize)]
struct ReadyPayload {
    /// Bound TCP port on loopback.
    port: u16,
    /// Username of the default local account.
    default_username: &'static str,
    /// Fixed passphrase of the default local account.
    default_password: &'static str,
}

/// Runs the local engine until its parent exits, then closes the pool.
pub async fn run() -> Result<(), Box<dyn Error>> {
    let data_dir = PathBuf::from(
        env::var("LEMMA_DATA_DIR")
            .map_err(|_| "LEMMA_DATA_DIR is required when LEMMA_LOCAL_MODE is set")?,
    );
    let secrets = load_or_create_secrets(&data_dir)?;
    let pool = lemma_db_sqlite::connect(data_dir.join("lemma.db")).await?;
    lemma_db_sqlite::migrate(&pool).await?;
    let auth_store = SqliteAuthStore::new(pool.clone());
    ensure_default_account(
        &auth_store,
        &AuthService::new(auth_store.clone(), secrets.jwt_secret.clone()),
    )
    .await?;
    let state = AppState::new(
        auth_store,
        SqliteConversationStore::new(pool.clone()),
        SqliteProviderStore::new(pool.clone()),
        secrets,
        Some(data_dir.join("workspaces")),
    );

    let listener = TcpListener::bind("127.0.0.1:0").await?;
    print_ready(&ReadyPayload {
        port: listener.local_addr()?.port(),
        default_username: DEFAULT_USERNAME,
        default_password: DEFAULT_PASSWORD,
    });
    http_server::serve(listener, routes::router(state), parent_exit()).await?;
    pool.close().await;
    Ok(())
}

/// Loads the secrets from `secrets.json` inside the data directory,
/// generating and persisting them on first run.
fn load_or_create_secrets(data_dir: &Path) -> Result<Secrets, String> {
    use rand::RngExt;

    let path = data_dir.join("secrets.json");
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).map_err(|e| format!("secrets.json: {e}")),
        Err(_) => {
            let secrets = Secrets {
                jwt_secret: hex::encode(rand::rng().random::<[u8; 32]>()),
                secret_key: hex::encode(rand::rng().random::<[u8; 32]>()),
            };
            fs::create_dir_all(data_dir)
                .map_err(|e| format!("create {}: {e}", data_dir.display()))?;
            let json = serde_json::to_string(&secrets).map_err(|e| format!("secrets.json: {e}"))?;
            fs::write(&path, json).map_err(|e| format!("write {}: {e}", path.display()))?;
            Ok(secrets)
        }
    }
}

/// Prints the readiness line announcing the local engine to its parent.
fn print_ready(payload: &ReadyPayload) {
    match serde_json::to_string(payload) {
        Ok(json) => println!("LEMMA_READY {json}"),
        Err(e) => eprintln!("ready payload: {e}"),
    }
}

/// Makes sure the default local account exists; called on every local
/// startup to guarantee predictable access across all runtimes.
async fn ensure_default_account<A: AuthStore>(
    store: &A,
    auth: &AuthService<A>,
) -> Result<(), String> {
    if store
        .find_user_by_login(DEFAULT_USERNAME)
        .await
        .map_err(|e| format!("default account lookup: {e}"))?
        .is_some()
    {
        return Ok(());
    }
    auth.sign_up(DEFAULT_USERNAME, DEFAULT_EMAIL, DEFAULT_PASSWORD)
        .await
        .map_err(|e| format!("default account: {e}"))?;
    Ok(())
}

/// The local engine lives exactly as long as its parent: completes when
/// stdin closes (the parent died) or on Ctrl-C during development.
async fn parent_exit() {
    use tokio::io::AsyncReadExt;

    let mut stdin = io::stdin();
    let mut sink = Vec::new();
    tokio::select! {
        _ = stdin.read_to_end(&mut sink) => {}
        _ = http_server::shutdown_signal() => {}
    }
}
