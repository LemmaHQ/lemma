//! Local engine mode: an embedded desktop engine. Serves the
//! [`LocalEngine`] over the data directory `LEMMA_DATA_DIR` on loopback
//! with an ephemeral port, and announces readiness and the default
//! account credentials on stdout.

use std::env;
use std::error::Error;
use std::path::PathBuf;

use lemma_auth::local::{DEFAULT_PASSWORD, DEFAULT_USERNAME};
use lemma_host::LocalEngine;
use serde::Serialize;
use tokio::io;
use tokio::net::TcpListener;

use crate::http_server;

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
    let engine = LocalEngine::open(&data_dir).await?;
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    print_ready(&ReadyPayload {
        port: listener.local_addr()?.port(),
        default_username: DEFAULT_USERNAME,
        default_password: DEFAULT_PASSWORD,
    });
    http_server::serve(listener, engine.router(), parent_exit()).await?;
    engine.close().await;
    Ok(())
}

/// Prints the readiness line announcing the local engine to its parent.
fn print_ready(payload: &ReadyPayload) {
    match serde_json::to_string(payload) {
        Ok(json) => println!("LEMMA_READY {json}"),
        Err(e) => eprintln!("ready payload: {e}"),
    }
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
