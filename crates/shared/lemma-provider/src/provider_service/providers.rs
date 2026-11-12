use std::fmt::{self, Debug};

use chrono::Utc;
use lemma_model::Connector;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, NotSet, QueryFilter,
    QueryOrder, Set, SqlErr,
};
use uuid::Uuid;

use crate::entity::provider::{self, Models, ProviderSource};
use crate::preset;
use crate::provider_error::ProviderError;

use super::ProviderModel;
use super::create_input::CreateCustomInput;
use super::provider_view::{CustomProviderView, PredefinedProviderView, ProviderView};
use super::update_input::UpdateCustomInput;

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

    pub(super) fn seal_key(&self, plain: &str) -> Result<String, ProviderError> {
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

    pub(super) fn view(&self, row: &provider::Model) -> Option<ProviderView> {
        match row.source {
            ProviderSource::Custom => Some(ProviderView::Custom(self.custom_view(row))),
            ProviderSource::Predefined => {
                let preset = preset::find(&row.identifier)?;
                Some(ProviderView::Predefined(self.predefined_view(row, preset)))
            }
        }
    }

    pub(super) fn predefined_view(
        &self,
        row: &provider::Model,
        preset: &preset::PredefinedProvider,
    ) -> PredefinedProviderView {
        PredefinedProviderView {
            id: row.id,
            identifier: preset.identifier.to_owned(),
            name: preset.name.to_owned(),
            api_formats: preset
                .formats
                .iter()
                .map(|format| format.api_format)
                .collect(),
            default_api_format: row.api_format,
            models: preset
                .models
                .iter()
                .map(|model| ProviderModel {
                    id: model.id.to_owned(),
                    tool_calling: model.tool_calling,
                })
                .collect(),
            api_key: self.open_key(&row.api_key).unwrap_or_default(),
            enabled: row.enabled,
        }
    }

    fn custom_view(&self, row: &provider::Model) -> CustomProviderView {
        CustomProviderView {
            id: row.id,
            identifier: row.identifier.clone(),
            name: row.name.clone(),
            api_format: row.api_format,
            base_url: row.base_url.clone(),
            api_key: self.open_key(&row.api_key).unwrap_or_default(),
            models: row.models.0.clone(),
            enabled: row.enabled,
            api_path: row.api_path.clone(),
            models_path: row.models_path.clone(),
        }
    }

    /// Lists predefined providers first, then custom providers in creation order.
    ///
    /// # Errors
    ///
    /// [`ProviderError::Store`] when the database fails.
    pub async fn list(&self, user_id: Uuid) -> Result<Vec<ProviderView>, ProviderError> {
        self.insert_missing_predefined(user_id).await?;
        let rows = provider::Entity::find()
            .filter(provider::Column::UserId.eq(user_id))
            .order_by_asc(provider::Column::CreatedAt)
            .all(&self.db)
            .await?;
        let mut views: Vec<_> = rows.iter().filter_map(|row| self.view(row)).collect();
        views.sort_by_key(|view| match view {
            ProviderView::Predefined(_) => 0,
            ProviderView::Custom(_) => 1,
        });
        Ok(views)
    }

    /// Validates and stores a new custom provider.
    ///
    /// # Errors
    ///
    /// [`ProviderError::IdentifierInvalid`] for an empty or non-ASCII identifier,
    /// [`ProviderError::FieldsRequired`] for an empty base URL,
    /// [`ProviderError::IdentifierTaken`] when the custom identifier is taken,
    /// [`ProviderError::Crypto`] when sealing fails, and [`ProviderError::Store`]
    /// when the database fails.
    pub async fn create_custom(
        &self,
        user_id: Uuid,
        input: CreateCustomInput,
    ) -> Result<CustomProviderView, ProviderError> {
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
        let row = provider::ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_id),
            api_format: Set(input.api_format),
            source: Set(ProviderSource::Custom),
            identifier: Set(identifier.to_owned()),
            name: Set(name.to_owned()),
            base_url: Set(base_url.to_owned()),
            api_key: Set(sealed),
            api_path: Set(input.api_path.trim().to_owned()),
            models_path: Set(input.models_path.trim().to_owned()),
            models: Set(Models(input.models)),
            enabled: Set(true),
            created_at: Set(Utc::now()),
        }
        .insert(&self.db)
        .await
        .map_err(|e| match e.sql_err() {
            Some(SqlErr::UniqueConstraintViolation(_)) => ProviderError::IdentifierTaken,
            _ => e.into(),
        })?;
        Ok(self.custom_view(&row))
    }

    /// Applies an update to a custom provider owned by the user.
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when no such custom provider exists,
    /// [`ProviderError::Crypto`] when sealing fails, and [`ProviderError::Store`]
    /// when the database fails.
    pub async fn update_custom(
        &self,
        user_id: Uuid,
        id: Uuid,
        input: UpdateCustomInput,
    ) -> Result<CustomProviderView, ProviderError> {
        let api_key = match input.api_key {
            Some(key) => Set(self.seal_key(&key)?),
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
            models: input.models.map_or(NotSet, |models| Set(Models(models))),
            enabled: input.enabled.map_or(NotSet, Set),
            ..Default::default()
        };
        if !changes.is_changed() {
            let row = self.find_custom(user_id, id).await?;
            return Ok(self.custom_view(&row));
        }
        provider::Entity::update_many()
            .set(changes)
            .filter(provider::Column::Id.eq(id))
            .filter(provider::Column::UserId.eq(user_id))
            .filter(provider::Column::Source.eq(ProviderSource::Custom))
            .exec_with_returning(&self.db)
            .await?
            .pop()
            .map(|row| self.custom_view(&row))
            .ok_or(ProviderError::NotFound)
    }

    /// Deletes a custom provider owned by the user.
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when no such custom provider exists and
    /// [`ProviderError::Store`] when the database fails.
    pub async fn delete_custom(&self, user_id: Uuid, id: Uuid) -> Result<(), ProviderError> {
        let deleted = provider::Entity::delete_many()
            .filter(provider::Column::Id.eq(id))
            .filter(provider::Column::UserId.eq(user_id))
            .filter(provider::Column::Source.eq(ProviderSource::Custom))
            .exec(&self.db)
            .await?;
        if deleted.rows_affected == 0 {
            return Err(ProviderError::NotFound);
        }
        Ok(())
    }

    pub(super) async fn find_custom(
        &self,
        user_id: Uuid,
        id: Uuid,
    ) -> Result<provider::Model, ProviderError> {
        provider::Entity::find_by_id(id)
            .filter(provider::Column::UserId.eq(user_id))
            .filter(provider::Column::Source.eq(ProviderSource::Custom))
            .one(&self.db)
            .await?
            .ok_or(ProviderError::NotFound)
    }
}
