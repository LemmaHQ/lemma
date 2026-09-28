#![allow(clippy::unwrap_used, missing_docs)]

use lemma_db_client::SqliteTraceStore;
use lemma_session::compliance;
use uuid::Uuid;

#[tokio::test]
async fn sqlite_store_compliance() {
    let store = SqliteTraceStore::in_memory().unwrap();
    compliance::run_suite(&store, Uuid::new_v4()).await;
}
