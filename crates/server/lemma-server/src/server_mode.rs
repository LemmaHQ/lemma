//! Server mode: PostgreSQL or SQLite by `DATABASE_URL`, fixed port 1025.

use std::error::Error;

use lemma_auth::AuthStore;
use lemma_conversation::ConversationStore;
use lemma_db_pgsql::{PgAuthStore, PgConversationStore, PgProviderStore};
use lemma_db_sqlite::{SqliteAuthStore, SqliteConversationStore, SqliteProviderStore};
use lemma_provider::ProviderStore;
use tokio::net::TcpListener;

use crate::app_state::AppState;
use crate::config::{Config, DatabaseBackend};
use crate::secrets::Secrets;
use crate::{http_server, routes};

/// Runs the server until Ctrl-C or SIGTERM, then closes the pool.
pub async fn run() -> Result<(), Box<dyn Error>> {
    let config = Config::from_env()?;
    match config.database_backend()? {
        DatabaseBackend::Postgres => {
            let pool = lemma_db_pgsql::connect(&config.database_url).await?;
            lemma_db_pgsql::migrate(&pool).await?;
            serve(
                PgAuthStore::new(pool.clone()),
                PgConversationStore::new(pool.clone()),
                PgProviderStore::new(pool.clone()),
                config.secrets,
            )
            .await?;
            pool.close().await;
        }
        DatabaseBackend::Sqlite => {
            let pool = lemma_db_sqlite::connect(config.sqlite_path()?).await?;
            lemma_db_sqlite::migrate(&pool).await?;
            serve(
                SqliteAuthStore::new(pool.clone()),
                SqliteConversationStore::new(pool.clone()),
                SqliteProviderStore::new(pool.clone()),
                config.secrets,
            )
            .await?;
            pool.close().await;
        }
    }
    Ok(())
}

async fn serve<A: AuthStore, S: ConversationStore, P: ProviderStore>(
    auth: A,
    conversations: S,
    providers: P,
    secrets: Secrets,
) -> Result<(), Box<dyn Error>> {
    let state = AppState::new(auth, conversations, providers, secrets, None);
    let listener = TcpListener::bind("0.0.0.0:1025").await?;
    println!("listening on {}", listener.local_addr()?);
    http_server::serve(listener, routes::router(state), async {
        match http_server::shutdown_signal().await {
            Ok(()) => println!("shutting down"),
            Err(e) => eprintln!("shutdown signal error: {e}"),
        }
    })
    .await?;
    Ok(())
}
