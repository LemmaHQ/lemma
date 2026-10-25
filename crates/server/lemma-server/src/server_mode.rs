//! Server mode: PostgreSQL or SQLite by `DATABASE_URL`, fixed port 1025.

use std::error::Error;

use lemma_host::{AppState, Secrets};
use sea_orm::DatabaseConnection;
use tokio::net::TcpListener;

use crate::config::Config;
use crate::http_server;

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
    http_server::serve(listener, lemma_host::router(state), async {
        match http_server::shutdown_signal().await {
            Ok(()) => println!("shutting down"),
            Err(e) => eprintln!("shutdown signal error: {e}"),
        }
    })
    .await?;
    Ok(())
}
