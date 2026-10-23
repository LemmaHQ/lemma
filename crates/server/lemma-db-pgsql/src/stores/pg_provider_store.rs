//! `ProviderStore` implementation over the providers queries.

use lemma_provider::{NewProvider, ProviderError, ProviderPatch, ProviderRecord, ProviderStore};
use sqlx::PgPool;
use uuid::Uuid;

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

/// [`ProviderStore`] backed by a PostgreSQL pool.
#[derive(Debug, Clone)]
pub struct PgProviderStore {
    pool: PgPool,
}

impl PgProviderStore {
    /// Creates the store over a pool.
    #[must_use]
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

impl ProviderStore for PgProviderStore {
    async fn insert(
        &self,
        user_id: Uuid,
        new: &NewProvider,
    ) -> Result<ProviderRecord, ProviderError> {
        providers::insert(&self.pool, user_id, new)
            .await
            .map(into_record)
            .map_err(insert_err)
    }

    async fn list(&self, user_id: Uuid) -> Result<Vec<ProviderRecord>, ProviderError> {
        providers::list_by_user(&self.pool, user_id)
            .await
            .map(|rows| rows.into_iter().map(into_record).collect())
            .map_err(store_err)
    }

    async fn get(&self, user_id: Uuid, id: Uuid) -> Result<Option<ProviderRecord>, ProviderError> {
        providers::find_by_id_and_user(&self.pool, id, user_id)
            .await
            .map(|row| row.map(into_record))
            .map_err(store_err)
    }

    async fn update(
        &self,
        user_id: Uuid,
        id: Uuid,
        patch: &ProviderPatch,
    ) -> Result<Option<ProviderRecord>, ProviderError> {
        providers::update(&self.pool, id, user_id, patch)
            .await
            .map(|row| row.map(into_record))
            .map_err(store_err)
    }

    async fn delete(&self, user_id: Uuid, id: Uuid) -> Result<bool, ProviderError> {
        providers::delete(&self.pool, id, user_id)
            .await
            .map_err(store_err)
    }
}
