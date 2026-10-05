//! Queries for the providers table.

use sqlx::types::Json;
use sqlx::{QueryBuilder, Sqlite};
use uuid::Uuid;

use lemma_provider::{NewProvider, ProviderPatch};

use crate::entity::Provider;
use crate::now_ms;

/// Inserts a provider and returns it.
pub async fn insert<'e, E>(executor: E, user_id: Uuid, p: &NewProvider) -> sqlx::Result<Provider>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    let now = now_ms();
    sqlx::query_as::<_, Provider>(
        r#"
        INSERT INTO providers (id, user_id, kind, identifier, name, base_url, api_key, api_path,
                               models_path, models, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
