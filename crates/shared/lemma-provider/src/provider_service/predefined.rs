use chrono::Utc;
use lemma_model::Connector;
use sea_orm::sea_query::OnConflict;
use sea_orm::{ColumnTrait, EntityTrait, NotSet, QueryFilter, Set};
use uuid::Uuid;

use crate::entity::provider::{self, Models, ProviderSource};
use crate::preset;
use crate::provider_error::ProviderError;

use super::provider_view::PredefinedProviderView;
use super::providers::ProviderService;
use super::update_input::UpdatePredefinedInput;

impl<C: Connector> ProviderService<C> {
    pub(super) async fn insert_missing_predefined(
        &self,
        user_id: Uuid,
    ) -> Result<(), ProviderError> {
        let now = Utc::now();
        let rows = preset::catalog()
            .iter()
            .map(|preset| provider::ActiveModel {
                id: Set(Uuid::new_v4()),
                user_id: Set(user_id),
                api_format: Set(preset.default_api_format),
                source: Set(ProviderSource::Predefined),
                identifier: Set(preset.identifier.to_owned()),
                name: Set(String::new()),
                base_url: Set(String::new()),
                api_key: Set(String::new()),
                api_path: Set(String::new()),
                models_path: Set(String::new()),
                models: Set(Models(Vec::new())),
                enabled: Set(false),
                created_at: Set(now),
            });
        provider::Entity::insert_many(rows)
            .on_conflict(
                OnConflict::columns([
                    provider::Column::UserId,
                    provider::Column::Source,
                    provider::Column::Identifier,
                ])
                .do_nothing()
                .to_owned(),
            )
            .exec_without_returning(&self.db)
            .await?;
        Ok(())
    }

    /// Updates a predefined provider's key, enabled flag, or default format.
    ///
    /// Clearing the key also disables the provider in the same statement, and
    /// enabling against the saved key requires the key to still be present at
    /// write time, so a concurrent clear and enable cannot leave the provider
    /// enabled without a key.
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when no such predefined provider exists,
    /// [`ProviderError::ApiFormatInvalid`] when the catalog does not serve the
    /// requested default, [`ProviderError::KeyRequired`] when the resulting
    /// provider would be enabled without a key, [`ProviderError::Crypto`] when
    /// sealing fails, and [`ProviderError::Store`] when the database fails.
    pub async fn update_predefined(
        &self,
        user_id: Uuid,
        id: Uuid,
        input: UpdatePredefinedInput,
    ) -> Result<PredefinedProviderView, ProviderError> {
        let row = provider::Entity::find_by_id(id)
            .filter(provider::Column::UserId.eq(user_id))
            .filter(provider::Column::Source.eq(ProviderSource::Predefined))
            .one(&self.db)
            .await?
            .ok_or(ProviderError::NotFound)?;
        let preset = preset::find(&row.identifier).ok_or(ProviderError::NotFound)?;
        if input
            .default_api_format
            .is_some_and(|format| !preset.serves(format))
        {
            return Err(ProviderError::ApiFormatInvalid);
        }
        let has_key = input
            .api_key
            .as_ref()
            .map_or(!row.api_key.is_empty(), |key| !key.is_empty());
        if input.enabled.unwrap_or(row.enabled) && !has_key {
            return Err(ProviderError::KeyRequired);
        }
        if input.api_key.is_none() && input.enabled.is_none() && input.default_api_format.is_none()
        {
            return Ok(self.predefined_view(&row, preset));
        }
        let clearing_key = input.api_key.as_deref() == Some("");
        let enabling_saved_key = input.enabled == Some(true) && input.api_key.is_none();
        let api_key = match input.api_key {
            Some(key) => Set(self.seal_key(&key)?),
            None => NotSet,
        };
        let enabled = if clearing_key {
            Set(false)
        } else {
            input.enabled.map_or(NotSet, Set)
        };
        let update = provider::Entity::update_many()
            .set(provider::ActiveModel {
                api_key,
                enabled,
                api_format: input.default_api_format.map_or(NotSet, Set),
                ..Default::default()
            })
            .filter(provider::Column::Id.eq(id))
            .filter(provider::Column::UserId.eq(user_id))
            .filter(provider::Column::Source.eq(ProviderSource::Predefined));
        if enabling_saved_key {
            let updated = update
                .filter(provider::Column::ApiKey.ne(""))
                .exec_with_returning(&self.db)
                .await?
                .pop()
                .ok_or(ProviderError::KeyRequired)?;
            return Ok(self.predefined_view(&updated, preset));
        }
        let updated = update
            .exec_with_returning(&self.db)
            .await?
            .pop()
            .ok_or(ProviderError::NotFound)?;
        Ok(self.predefined_view(&updated, preset))
    }
}
