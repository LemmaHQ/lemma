//! Server mode: PostgreSQL or SQLite by `DATABASE_URL`, fixed port 1025.

use std::error::Error;

use lemma_conversation::ConversationStore;
use lemma_db_pgsql::{PgConversationStore, PgProviderStore};
use lemma_db_sqlite::{SqliteConversationStore, SqliteProviderStore};
use lemma_host::{AppState, Secrets};
use lemma_provider::ProviderStore;
use sea_orm::{DatabaseConnection, SqlxPostgresConnector, SqlxSqliteConnector};
use tokio::net::TcpListener;

use crate::config::{Config, DatabaseBackend};
use crate::http_server;

/// Runs the server until Ctrl-C or SIGTERM, then closes the pool.
pub async fn run() -> Result<(), Box<dyn Error>> {
    let config = Config::from_env()?;
    match config.database_backend()? {
        DatabaseBackend::Postgres => {
            let pool = lemma_db_pgsql::connect(&config.database_url).await?;
            let db = SqlxPostgresConnector::from_sqlx_postgres_pool(pool.clone());
            lemma_host::migrate(&db).await?;
            lemma_db_pgsql::migrate(&pool).await?;
            serve(
                db,
                PgConversationStore::new(pool.clone()),
                PgProviderStore::new(pool.clone()),
                config.secrets,
            )
            .await?;
            pool.close().await;
        }
        DatabaseBackend::Sqlite => {
            let pool = lemma_db_sqlite::connect(config.sqlite_path()?).await?;
            let db = SqlxSqliteConnector::from_sqlx_sqlite_pool(pool.clone());
            lemma_host::migrate(&db).await?;
            lemma_db_sqlite::migrate(&pool).await?;
            serve(
                db,
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

async fn serve<S: ConversationStore, P: ProviderStore>(
    db: DatabaseConnection,
    conversations: S,
    providers: P,
    secrets: Secrets,
) -> Result<(), Box<dyn Error>> {
    let state = AppState::new(db, conversations, providers, secrets, None);
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
