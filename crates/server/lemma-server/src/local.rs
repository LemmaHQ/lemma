//! Local engine mode: an embedded desktop engine. The SQLite database,
//! the signing secrets, and a default local account all live under a
//! single data directory.

use std::path::{Path, PathBuf};

use lemma_auth::{AuthStore, AuthService};
use rand::RngExt;
use serde::{Deserialize, Serialize};

/// Fixed passphrase of the default local account. It is public by design:
/// it is not a secret, it is the no-login entry point for the desktop
/// engine. Accounts a user registers themselves carry real passwords.
pub const DEFAULT_USERNAME: &str = "lemma";
const DEFAULT_EMAIL: &str = "lemma@local";
pub const DEFAULT_PASSWORD: &str = "lemma-local-default";

/// Secrets the engine manages itself in local mode, persisted next to the
/// database so tokens survive restarts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalSecrets {
    /// Signs and verifies access tokens.
    pub jwt_secret: String,
    /// Master secret from which credential-sealing keys are derived.
    pub secret_key: String,
}

/// Loads the secrets from `secrets.json` inside the data directory,
/// generating and persisting them on first run.
pub fn load_or_create_secrets(data_dir: &Path) -> Result<LocalSecrets, String> {
    let path = data_dir.join("secrets.json");
    match std::fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).map_err(|e| format!("secrets.json: {e}")),
        Err(_) => {
            let secrets = LocalSecrets {
                jwt_secret: hex::encode(rand::rng().random::<[u8; 32]>()),
                secret_key: hex::encode(rand::rng().random::<[u8; 32]>()),
            };
            std::fs::create_dir_all(data_dir)
                .map_err(|e| format!("create {}: {e}", data_dir.display()))?;
            let json =
                serde_json::to_string(&secrets).map_err(|e| format!("secrets.json: {e}"))?;
            std::fs::write(&path, json).map_err(|e| format!("write {}: {e}", path.display()))?;
            Ok(secrets)
        }
    }
}

/// Local database path derived from the data directory.
pub fn database_path(data_dir: &Path) -> PathBuf {
    data_dir.join("lemma.db")
}

/// Startup handshake printed to stdout so the Electron shell can pick up
/// the port and the default account's credentials.
#[derive(Debug, Clone, Serialize)]
pub struct ReadyPayload {
    /// Bound TCP port on loopback.
    pub port: u16,
    /// Username of the default local account.
    pub default_username: String,
    /// Fixed passphrase of the default local account.
    pub default_password: String,
}

/// Prints the readiness line announcing the local engine to its parent.
pub fn print_ready(payload: &ReadyPayload) {
    match serde_json::to_string(payload) {
        Ok(json) => println!("LEMMA_READY {json}"),
        Err(e) => eprintln!("ready payload: {e}"),
    }
}

/// Makes sure the default local account exists; called on every local
/// startup so a user who signed up first never blocks it.
pub async fn ensure_default_account(
    store: &dyn AuthStore,
    auth: &AuthService,
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
