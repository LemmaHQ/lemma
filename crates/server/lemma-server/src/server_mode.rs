//! Server mode: PostgreSQL or SQLite by `DATABASE_URL`, fixed port 1025.

use std::error::Error;
use std::io;

use lemma_host::{AppState, Secrets};
use sea_orm::DatabaseConnection;
use tokio::net::TcpListener;
use tokio::signal;

use crate::config::Config;

/// Runs the server until Ctrl-C or SIGTERM, then closes the database.
pub async fn run() -> Result<(), Box<dyn Error>> {
    let config = Config::from_env()?;
    let db = lemma_host::connect(&config.database_url).await?;
    lemma_host::migrate(&db).await?;
    serve(db.clone(), config.secrets).await?;
    db.close().await?;
    Ok(())
}

async fn serve(db: DatabaseConnection, secrets: Secrets) -> Result<(), Box<dyn Error>> {
    let state = AppState::new(db, secrets, None);
    let listener = TcpListener::bind("0.0.0.0:1025").await?;
    println!("listening on {}", listener.local_addr()?);
    lemma_server::serve(listener, lemma_host::router(state), async {
        match shutdown_signal().await {
            Ok(()) => println!("shutting down"),
            Err(e) => eprintln!("shutdown signal error: {e}"),
        }
    })
    .await?;
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
