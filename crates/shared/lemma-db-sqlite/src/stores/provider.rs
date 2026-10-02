//! `ProviderStore` implementation over the providers queries.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use lemma_provider::{
    BoxProviderFuture, NewProvider, ProviderError, ProviderPatch, ProviderRecord, ProviderStore,
};

use crate::entity::Provider;
use crate::queries::providers;

fn timestamp(ms: i64) -> Result<DateTime<Utc>, ProviderError> {
    DateTime::from_timestamp_millis(ms)
        .ok_or_else(|| ProviderError::Store(format!("timestamp out of range: {ms}")))
}

fn into_record(p: Provider) -> Result<ProviderRecord, ProviderError> {
    Ok(ProviderRecord {
        id: p.id,
        user_id: p.user_id,
        kind: p.kind,
        name: p.name,
        base_url: p.base_url,
        api_key: p.api_key,
        api_path: p.api_path,
        models_path: p.models_path,
        models: p.models.0,
        enabled: p.enabled,
        created_at: timestamp(p.created_at)?,
        updated_at: timestamp(p.updated_at)?,
    })
}

fn store_err(e: sqlx::Error) -> ProviderError {
    ProviderError::Store(e.to_string())
}

/// [`ProviderStore`] backed by a SQLite pool.
pub struct SqliteProviderStore {
    pool: sqlx::SqlitePool,
}

impl SqliteProviderStore {
    /// Creates the store over a pool.
    pub fn new(pool: sqlx::SqlitePool) -> Self {
        Self { pool }
    }
}

impl ProviderStore for SqliteProviderStore {
    fn insert<'a>(
        &'a self,
        user_id: Uuid,
        new: &'a NewProvider,
    ) -> BoxProviderFuture<'a, ProviderRecord> {
        Box::pin(async move {
            providers::insert(&self.pool, user_id, new)
                .await
                .map_err(store_err)
                .and_then(into_record)
        })
    }

    fn list<'a>(&'a self, user_id: Uuid) -> BoxProviderFuture<'a, Vec<ProviderRecord>> {
        Box::pin(async move {
            providers::list_by_user(&self.pool, user_id)
                .await
                .map_err(store_err)?
                .into_iter()
                .map(into_record)
                .collect()
        })
    }

    fn get<'a>(&'a self, user_id: Uuid, id: Uuid) -> BoxProviderFuture<'a, Option<ProviderRecord>> {
        Box::pin(async move {
            providers::find_by_id_and_user(&self.pool, id, user_id)
                .await
                .map_err(store_err)?
                .map(into_record)
                .transpose()
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
                .map_err(store_err)?
                .map(into_record)
                .transpose()
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
