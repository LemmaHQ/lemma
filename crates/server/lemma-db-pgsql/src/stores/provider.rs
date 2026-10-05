//! `ProviderStore` implementation over the providers queries.

use uuid::Uuid;

use lemma_provider::{
    BoxProviderFuture, NewProvider, ProviderError, ProviderPatch, ProviderRecord, ProviderStore,
};

use crate::entity::Provider;
use crate::queries::providers;

fn into_record(p: Provider) -> ProviderRecord {
    ProviderRecord {
        id: p.id,
        user_id: p.user_id,
        kind: p.kind,
        identifier: p.identifier,
        name: p.name,
        base_url: p.base_url,
        api_key: p.api_key,
        api_path: p.api_path,
        models_path: p.models_path,
        models: p.models.0,
        enabled: p.enabled,
        created_at: p.created_at,
        updated_at: p.updated_at,
    }
}

fn store_err(e: sqlx::Error) -> ProviderError {
    ProviderError::Store(e.to_string())
}

fn insert_err(e: sqlx::Error) -> ProviderError {
    match &e {
        sqlx::Error::Database(db) if db.is_unique_violation() => ProviderError::IdentifierTaken,
        _ => ProviderError::Store(e.to_string()),
    }
}

/// [`ProviderStore`] backed by a PostgreSQL pool.
pub struct PgProviderStore {
    pool: sqlx::PgPool,
}

impl PgProviderStore {
    /// Creates the store over a pool.
    pub fn new(pool: sqlx::PgPool) -> Self {
        Self { pool }
    }
}

impl ProviderStore for PgProviderStore {
    fn insert<'a>(
        &'a self,
        user_id: Uuid,
        new: &'a NewProvider,
    ) -> BoxProviderFuture<'a, ProviderRecord> {
        Box::pin(async move {
            providers::insert(&self.pool, user_id, new)
                .await
                .map(into_record)
                .map_err(insert_err)
        })
    }

    fn list<'a>(&'a self, user_id: Uuid) -> BoxProviderFuture<'a, Vec<ProviderRecord>> {
        Box::pin(async move {
            providers::list_by_user(&self.pool, user_id)
                .await
                .map(|rows| rows.into_iter().map(into_record).collect())
                .map_err(store_err)
        })
    }

    fn get<'a>(&'a self, user_id: Uuid, id: Uuid) -> BoxProviderFuture<'a, Option<ProviderRecord>> {
        Box::pin(async move {
            providers::find_by_id_and_user(&self.pool, id, user_id)
                .await
                .map(|row| row.map(into_record))
                .map_err(store_err)
        })
    }

    fn update<'a>(
        &'a self,
        user_id: Uuid,
        id: Uuid,
        patch: ProviderPatch,
    ) -> BoxProviderFuture<'a, Option<ProviderRecord>> {
        Box::pin(async move {
            providers::update(&self.pool, id, user_id, patch)
                .await
                .map(|row| row.map(into_record))
                .map_err(store_err)
        })
    }

    fn delete<'a>(&'a self, user_id: Uuid, id: Uuid) -> BoxProviderFuture<'a, bool> {
        Box::pin(async move {
            providers::delete(&self.pool, id, user_id)
                .await
                .map_err(store_err)
        })
    }
}
