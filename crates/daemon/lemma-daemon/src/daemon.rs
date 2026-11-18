//! The daemon: the engine over `LEMMA_DATA_DIR`, listening on
//! `127.0.0.1:LEMMA_PORT`.

use std::error::Error;
use std::io;

use lemma_engine::Engine;
use tokio::net::TcpListener;
use tokio::signal;

use crate::config::Config;

/// Runs the daemon until Ctrl-C or SIGTERM, then closes the engine.
pub async fn run() -> Result<(), Box<dyn Error>> {
    let config = Config::from_env()?;
    let engine = Engine::open(&config.data_dir).await?;
    let listener = TcpListener::bind(("127.0.0.1", config.port)).await?;
    println!("listening on {}", listener.local_addr()?);
    lemma_daemon::serve(listener, engine.router(), async {
        match shutdown_signal().await {
            Ok(()) => println!("shutting down"),
            Err(e) => eprintln!("shutdown signal error: {e}"),
        }
    })
    .await?;
    engine.close().await;
    Ok(())
}

/// Completes on Ctrl-C, or on SIGTERM where signals exist.
#[cfg(unix)]
async fn shutdown_signal() -> io::Result<()> {
    use tokio::signal::unix::{self, SignalKind};

    let mut terminate = unix::signal(SignalKind::terminate())?;
    tokio::select! {
        result = signal::ctrl_c() => result,
        _ = terminate.recv() => Ok(()),
    }
}

/// Completes on Ctrl-C, or on SIGTERM where signals exist.
#[cfg(not(unix))]
async fn shutdown_signal() -> io::Result<()> {
    signal::ctrl_c().await
}
