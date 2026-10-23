//! Queries for the providers table.

use sqlx::QueryBuilder;
use sqlx::types::Json;
use uuid::Uuid;

use lemma_provider::{NewProvider, ProviderPatch};

use crate::entity::Provider;

/// Inserts a provider and returns it.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn insert<'conn, E>(executor: E, user_id: Uuid, p: &NewProvider) -> sqlx::Result<Provider>
where
    E: sqlx::Executor<'conn, Database = sqlx::Postgres>,
{
    sqlx::query_as::<_, Provider>(
        r#"
        INSERT INTO providers (id, user_id, kind, identifier, name, base_url, api_key, api_path,
                               models_path, models)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        "#,
    )
    .bind(p.id)
    .bind(user_id)
    .bind(&p.kind)
    .bind(&p.identifier)
    .bind(&p.name)
    .bind(&p.base_url)
    .bind(&p.api_key)
    .bind(&p.api_path)
    .bind(&p.models_path)
    .bind(Json(p.models.clone()))
    .fetch_one(executor)
    .await
}

/// Lists a user's providers in creation order.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn list_by_user<'conn, E>(executor: E, user_id: Uuid) -> sqlx::Result<Vec<Provider>>
where
    E: sqlx::Executor<'conn, Database = sqlx::Postgres>,
{
    sqlx::query_as::<_, Provider>("SELECT * FROM providers WHERE user_id = $1 ORDER BY created_at")
        .bind(user_id)
        .fetch_all(executor)
        .await
}

/// Finds a provider owned by the given user.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn find_by_id_and_user<'conn, E>(
    executor: E,
    id: Uuid,
    user_id: Uuid,
) -> sqlx::Result<Option<Provider>>
where
    E: sqlx::Executor<'conn, Database = sqlx::Postgres>,
{
    sqlx::query_as::<_, Provider>("SELECT * FROM providers WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .fetch_optional(executor)
        .await
}

/// Applies a patch to a provider owned by the given user, returning the
/// updated row or `None` for missing records.
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn update<'conn, E>(
    executor: E,
    id: Uuid,
    user_id: Uuid,
    patch: &ProviderPatch,
) -> sqlx::Result<Option<Provider>>
where
    E: sqlx::Executor<'conn, Database = sqlx::Postgres>,
{
    let mut qb: QueryBuilder<sqlx::Postgres> = QueryBuilder::new("UPDATE providers SET ");
    {
        let mut sep = qb.separated(", ");
        sep.push("updated_at = now()");
        if let Some(v) = &patch.name {
            sep.push(" name = ").push_bind_unseparated(v);
        }
        if let Some(v) = &patch.base_url {
            sep.push(" base_url = ").push_bind_unseparated(v);
        }
        if let Some(v) = &patch.api_key {
            sep.push(" api_key = ").push_bind_unseparated(v);
        }
        if let Some(v) = &patch.api_path {
            sep.push(" api_path = ").push_bind_unseparated(v);
        }
        if let Some(v) = &patch.models_path {
            sep.push(" models_path = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.enabled {
            sep.push(" enabled = ").push_bind_unseparated(v);
        }
        if let Some(v) = &patch.models {
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
///
/// # Errors
///
/// Propagates the [`sqlx::Error`] of the query.
pub async fn delete<'conn, E>(executor: E, id: Uuid, user_id: Uuid) -> sqlx::Result<bool>
where
    E: sqlx::Executor<'conn, Database = sqlx::Postgres>,
{
    sqlx::query("DELETE FROM providers WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(executor)
        .await
        .map(|r| r.rows_affected() > 0)
}
