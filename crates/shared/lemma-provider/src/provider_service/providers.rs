use std::fmt::{self, Debug};

use chrono::Utc;
use lemma_model::{Connector, ProviderKind};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, NotSet, QueryFilter,
    QueryOrder, Set, SqlErr,
};
use uuid::Uuid;

use crate::entity::provider;
use crate::entity::provider::Models;
use crate::provider_error::ProviderError;

use super::create_input::CreateInput;
use super::provider_view::ProviderView;
use super::update_input::UpdateInput;

/// Provider domain service over a database holding the providers table.
///
/// `secret_key` seals API keys with lemma-crypto. `connector` binds
/// providers to adapters and fetches live model lists.
pub struct ProviderService<C> {
    pub(super) db: DatabaseConnection,
    pub(super) secret_key: String,
    pub(super) connector: C,
}

impl<C: Debug> Debug for ProviderService<C> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ProviderService")
            .field("db", &self.db)
            .field("connector", &self.connector)
            .finish_non_exhaustive()
    }
}

impl<C: Connector> ProviderService<C> {
    /// Creates the service over a database.
    pub fn new(db: DatabaseConnection, secret_key: String, connector: C) -> Self {
        Self {
            db,
            secret_key,
            connector,
        }
    }

    fn seal_key(&self, plain: &str) -> Result<String, ProviderError> {
        if plain.is_empty() {
            return Ok(String::new());
        }
        lemma_crypto::seal(&lemma_crypto::derive_key(&self.secret_key), plain)
            .map_err(ProviderError::Crypto)
    }

    pub(super) fn open_key(&self, stored: &str) -> Result<String, ProviderError> {
        if stored.is_empty() {
            return Ok(String::new());
        }
        lemma_crypto::open(&lemma_crypto::derive_key(&self.secret_key), stored)
            .map_err(ProviderError::Crypto)
    }

    fn view(&self, r: &provider::Model) -> ProviderView {
        let api_key = self.open_key(&r.api_key).unwrap_or_default();
        ProviderView {
            id: r.id,
            kind: kind_of(r),
            identifier: r.identifier.clone(),
            name: r.name.clone(),
            base_url: r.base_url.clone(),
            api_key,
            models: r.models.0.clone(),
            enabled: r.enabled,
            api_path: r.api_path.clone(),
            models_path: r.models_path.clone(),
        }
    }

    /// Lists the user's providers in creation order.
    ///
    /// # Errors
    ///
    /// [`ProviderError::Store`] when the database fails.
    pub async fn list(&self, user_id: Uuid) -> Result<Vec<ProviderView>, ProviderError> {
        let rows = provider::Entity::find()
            .filter(provider::Column::UserId.eq(user_id))
            .order_by_asc(provider::Column::CreatedAt)
            .all(&self.db)
            .await?;
        Ok(rows.iter().map(|r| self.view(r)).collect())
    }

    /// Validates and stores a new provider.
    ///
    /// # Errors
    ///
    /// [`ProviderError::IdentifierInvalid`] for an empty or non-ASCII
    /// identifier, [`ProviderError::FieldsRequired`] for an empty base URL,
    /// [`ProviderError::IdentifierTaken`] when the user already has a
    /// provider with the identifier, [`ProviderError::Crypto`] when sealing
    /// the key fails, and [`ProviderError::Store`] when the database fails.
    pub async fn create(
        &self,
        user_id: Uuid,
        input: CreateInput,
    ) -> Result<ProviderView, ProviderError> {
        let kind = input.kind.as_str();
        let identifier = input.identifier.trim();
        let name = input.name.trim();
        let name = if name.is_empty() { identifier } else { name };
        let base_url = input.base_url.trim().trim_end_matches('/');
        if identifier.is_empty() || !identifier.is_ascii() {
            return Err(ProviderError::IdentifierInvalid);
        }
        if base_url.is_empty() {
            return Err(ProviderError::FieldsRequired);
        }
        let sealed = self.seal_key(&input.api_key)?;
        let now = Utc::now();
        let row = provider::ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_id),
            kind: Set(kind.to_owned()),
            identifier: Set(identifier.to_owned()),
            name: Set(name.to_owned()),
            base_url: Set(base_url.to_owned()),
            api_key: Set(sealed),
            api_path: Set(input.api_path.trim().to_owned()),
            models_path: Set(input.models_path.trim().to_owned()),
            models: Set(Models(input.models)),
            enabled: Set(true),
            created_at: Set(now),
        }
        .insert(&self.db)
        .await
        .map_err(|e| match e.sql_err() {
            Some(SqlErr::UniqueConstraintViolation(_)) => ProviderError::IdentifierTaken,
            _ => e.into(),
        })?;
        Ok(self.view(&row))
    }

    /// Applies an update to a provider owned by the user.
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when the user owns no such provider,
    /// [`ProviderError::Crypto`] when sealing the key fails, and
    /// [`ProviderError::Store`] when the database fails.
    pub async fn update(
        &self,
        user_id: Uuid,
        id: Uuid,
        input: UpdateInput,
    ) -> Result<ProviderView, ProviderError> {
        let api_key = match input.api_key {
            Some(k) => Set(self.seal_key(&k)?),
            None => NotSet,
        };
        let changes = provider::ActiveModel {
            name: input.name.map_or(NotSet, |s| Set(s.trim().to_owned())),
            base_url: input
                .base_url
                .map_or(NotSet, |s| Set(s.trim().trim_end_matches('/').to_owned())),
            api_key,
            api_path: input.api_path.map_or(NotSet, |s| Set(s.trim().to_owned())),
            models_path: input
                .models_path
                .map_or(NotSet, |s| Set(s.trim().to_owned())),
            models: input.models.map_or(NotSet, |m| Set(Models(m))),
            enabled: input.enabled.map_or(NotSet, Set),
            ..Default::default()
        };
        if !changes.is_changed() {
            let row = provider::Entity::find_by_id(id)
                .filter(provider::Column::UserId.eq(user_id))
                .one(&self.db)
                .await?
                .ok_or(ProviderError::NotFound)?;
            return Ok(self.view(&row));
        }
        provider::Entity::update_many()
            .set(changes)
            .filter(provider::Column::Id.eq(id))
            .filter(provider::Column::UserId.eq(user_id))
            .exec_with_returning(&self.db)
            .await?
            .pop()
            .map(|row| self.view(&row))
            .ok_or(ProviderError::NotFound)
    }

    /// Deletes a provider owned by the user.
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when the user owns no such provider and
    /// [`ProviderError::Store`] when the database fails.
    pub async fn delete(&self, user_id: Uuid, id: Uuid) -> Result<(), ProviderError> {
        let deleted = provider::Entity::delete_many()
            .filter(provider::Column::Id.eq(id))
            .filter(provider::Column::UserId.eq(user_id))
            .exec(&self.db)
            .await?;
        if deleted.rows_affected == 0 {
            return Err(ProviderError::NotFound);
        }
        Ok(())
    }
}

pub(super) fn kind_of(row: &provider::Model) -> ProviderKind {
    use std::str::FromStr;

    ProviderKind::from_str(&row.kind).unwrap_or(ProviderKind::OpenAiCompatible)
}
