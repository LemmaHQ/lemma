#![allow(clippy::unwrap_used, missing_docs)]

use lemma_auth::users;
use lemma_conversations::PgTraceStore;
use lemma_session::compliance;
use sqlx::PgPool;
use uuid::Uuid;

#[sqlx::test(migrations = "../lemma-db-pgsql/migrations")]
async fn pg_store_compliance(pool: PgPool) {
    let name = format!("u-{}", Uuid::new_v4());
    let user_id = users::insert(&pool, &name, &format!("{name}@example.com"), "hash")
        .await
        .unwrap()
        .id;
    let provider_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO providers (id, user_id, kind, name, base_url, api_key, models, created_at, updated_at)
         VALUES ($1, $2, 'openai_compatible', 'mock', 'http://mock', 'k', '[]', NOW(), NOW())",
    )
    .bind(provider_id)
    .bind(user_id)
    .execute(&pool)
    .await
    .unwrap();
    let store = PgTraceStore::new(pool, user_id);
    compliance::run_suite(&store, provider_id).await;
}
