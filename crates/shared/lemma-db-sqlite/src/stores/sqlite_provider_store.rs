//! `ProviderStore` implementation over the providers queries.

use chrono::{DateTime, Utc};
use lemma_provider::{NewProvider, ProviderError, ProviderPatch, ProviderRecord, ProviderStore};
use sqlx::SqlitePool;
use uuid::Uuid;

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
        identifier: p.identifier,
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

#[expect(clippy::needless_pass_by_value, reason = "used as a map_err function")]
fn store_err(e: sqlx::Error) -> ProviderError {
    ProviderError::Store(e.to_string())
}

#[expect(clippy::needless_pass_by_value, reason = "used as a map_err function")]
fn insert_err(e: sqlx::Error) -> ProviderError {
    match &e {
        sqlx::Error::Database(db) if db.is_unique_violation() => ProviderError::IdentifierTaken,
        _ => ProviderError::Store(e.to_string()),
    }
}

/// [`ProviderStore`] backed by a SQLite pool.
#[derive(Debug, Clone)]
pub struct SqliteProviderStore {
    pool: SqlitePool,
}

impl SqliteProviderStore {
    /// Creates the store over a pool.
    #[must_use]
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

impl ProviderStore for SqliteProviderStore {
    async fn insert(
        &self,
        user_id: Uuid,
        new: &NewProvider,
    ) -> Result<ProviderRecord, ProviderError> {
        providers::insert(&self.pool, user_id, new)
            .await
            .map_err(insert_err)
            .and_then(into_record)
    }

    async fn list(&self, user_id: Uuid) -> Result<Vec<ProviderRecord>, ProviderError> {
        providers::list_by_user(&self.pool, user_id)
            .await
            .map_err(store_err)?
            .into_iter()
            .map(into_record)
            .collect()
    }

    async fn get(&self, user_id: Uuid, id: Uuid) -> Result<Option<ProviderRecord>, ProviderError> {
        providers::find_by_id_and_user(&self.pool, id, user_id)
            .await
            .map_err(store_err)?
            .map(into_record)
            .transpose()
    }

    async fn update(
        &self,
        user_id: Uuid,
        id: Uuid,
        patch: &ProviderPatch,
    ) -> Result<Option<ProviderRecord>, ProviderError> {
        providers::update(&self.pool, id, user_id, patch)
            .await
            .map_err(store_err)?
            .map(into_record)
            .transpose()
    }

    async fn delete(&self, user_id: Uuid, id: Uuid) -> Result<bool, ProviderError> {
        providers::delete(&self.pool, id, user_id)
            .await
            .map_err(store_err)
    }
}
