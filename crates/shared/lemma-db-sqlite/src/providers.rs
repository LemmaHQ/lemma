//! Queries for the providers table.

use chrono::{DateTime, Utc};
use sqlx::types::Json;
use sqlx::{QueryBuilder, Sqlite};
use uuid::Uuid;

use lemma_provider::{
    BoxProviderFuture, NewProvider, ProviderError, ProviderPatch, ProviderRecord, ProviderStore,
};

use crate::entity::Provider;
use crate::now_ms;

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
            insert(&self.pool, user_id, new)
                .await
                .map_err(store_err)
                .and_then(into_record)
        })
    }

    fn list<'a>(&'a self, user_id: Uuid) -> BoxProviderFuture<'a, Vec<ProviderRecord>> {
        Box::pin(async move {
            list_by_user(&self.pool, user_id)
                .await
                .map_err(store_err)?
                .into_iter()
                .map(into_record)
                .collect()
        })
    }

    fn get<'a>(&'a self, user_id: Uuid, id: Uuid) -> BoxProviderFuture<'a, Option<ProviderRecord>> {
        Box::pin(async move {
            find_by_id_and_user(&self.pool, id, user_id)
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
            update(&self.pool, id, user_id, patch)
                .await
                .map_err(store_err)?
                .map(into_record)
                .transpose()
        })
    }

    fn delete<'a>(&'a self, user_id: Uuid, id: Uuid) -> BoxProviderFuture<'a, bool> {
        Box::pin(async move { delete(&self.pool, id, user_id).await.map_err(store_err) })
    }
}

/// Inserts a provider and returns it.
pub async fn insert<'e, E>(executor: E, user_id: Uuid, p: &NewProvider) -> sqlx::Result<Provider>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    let now = now_ms();
    sqlx::query_as::<_, Provider>(
        r#"
        INSERT INTO providers (id, user_id, kind, name, base_url, api_key, api_path, models_path,
                               models, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(p.id)
    .bind(user_id)
    .bind(&p.kind)
    .bind(&p.name)
    .bind(&p.base_url)
    .bind(&p.api_key)
    .bind(&p.api_path)
    .bind(&p.models_path)
    .bind(Json(p.models.clone()))
    .bind(now)
    .bind(now)
    .fetch_one(executor)
    .await
}

/// Lists a user's providers in creation order.
pub async fn list_by_user<'e, E>(executor: E, user_id: Uuid) -> sqlx::Result<Vec<Provider>>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query_as::<_, Provider>("SELECT * FROM providers WHERE user_id = ? ORDER BY created_at")
        .bind(user_id)
        .fetch_all(executor)
        .await
}

/// Finds a provider owned by the given user.
pub async fn find_by_id_and_user<'e, E>(
    executor: E,
    id: Uuid,
    user_id: Uuid,
) -> sqlx::Result<Option<Provider>>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query_as::<_, Provider>("SELECT * FROM providers WHERE id = ? AND user_id = ?")
        .bind(id)
        .bind(user_id)
        .fetch_optional(executor)
        .await
}

/// Applies a patch to a provider owned by the given user, returning the
/// updated row or `None` when it does not exist.
pub async fn update<'e, E>(
    executor: E,
    id: Uuid,
    user_id: Uuid,
    patch: ProviderPatch,
) -> sqlx::Result<Option<Provider>>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    let mut qb: QueryBuilder<Sqlite> = QueryBuilder::new("UPDATE providers SET ");
    {
        let mut sep = qb.separated(", ");
        sep.push("updated_at = ").push_bind_unseparated(now_ms());
        if let Some(v) = patch.name {
            sep.push(" name = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.base_url {
            sep.push(" base_url = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.api_key {
            sep.push(" api_key = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.api_path {
            sep.push(" api_path = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.models_path {
            sep.push(" models_path = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.enabled {
            sep.push(" enabled = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.models {
            sep.push(" models = ").push_bind_unseparated(Json(v));
        }
    }
    qb.push(" WHERE id = ").push_bind(id);
    qb.push(" AND user_id = ").push_bind(user_id);
    qb.push(" RETURNING *");
    qb.build_query_as::<Provider>()
        .fetch_optional(executor)
        .await
}

/// Deletes a provider owned by the given user, returning whether a row
/// was removed.
pub async fn delete<'e, E>(executor: E, id: Uuid, user_id: Uuid) -> sqlx::Result<bool>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query("DELETE FROM providers WHERE id = ? AND user_id = ?")
        .bind(id)
        .bind(user_id)
        .execute(executor)
        .await
        .map(|r| r.rows_affected() > 0)
}
