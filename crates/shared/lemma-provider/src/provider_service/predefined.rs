use chrono::Utc;
use uuid::Uuid;

use lemma_model::{ApiFormat, Connector};

use crate::preset::{self, PredefinedProvider};
use crate::provider_error::ProviderError;
use crate::provider_model::ProviderModel;
use crate::provider_row::{self, ProviderRow, ProviderSource, ProviderTuple};

use super::provider_view::PredefinedProviderView;
use super::providers::ProviderService;
use super::update_input::UpdatePredefinedInput;

impl<C: Connector> ProviderService<C> {
    pub(super) async fn insert_missing_predefined(&self) -> Result<(), ProviderError> {
        let now = Utc::now();
        for preset in preset::catalog() {
            sqlx::query(
                "INSERT INTO providers (
                     id, api_format, source, identifier, name, base_url,
                     api_key, api_path, models_path, models, enabled, created_at
                 )
                 VALUES (?, ?, 'predefined', ?, '', '', '', '', '', '[]', 0, ?)
                 ON CONFLICT (source, identifier) DO NOTHING",
            )
            .bind(Uuid::new_v4())
            .bind(preset.default_api_format.as_str())
            .bind(preset.identifier)
            .bind(now)
            .execute(&self.db)
            .await?;
        }
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
    /// sealing or opening a key fails, and [`ProviderError::Store`] when the
    /// database fails.
    pub async fn update_predefined(
        &self,
        id: Uuid,
        input: UpdatePredefinedInput,
    ) -> Result<PredefinedProviderView, ProviderError> {
        let row = self.find_row(id).await?;
        if row.source != ProviderSource::Predefined {
            return Err(ProviderError::NotFound);
        }
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
            return self.predefined_view(&row, preset);
        }
        let clearing_key = input.api_key.as_deref() == Some("");
        let enabling_saved_key = input.enabled == Some(true) && input.api_key.is_none();
        let api_key = input
            .api_key
            .as_deref()
            .map(|key| self.seal_key(key))
            .transpose()?;
        let enabled = if clearing_key {
            Some(false)
        } else {
            input.enabled
        };
        let api_format = input.default_api_format.map(ApiFormat::as_str);
        let missing_error = if enabling_saved_key {
            ProviderError::KeyRequired
        } else {
            ProviderError::NotFound
        };
        let updated = sqlx::query_as::<_, ProviderTuple>(
            "UPDATE providers
             SET api_key = COALESCE(?, api_key),
                 enabled = COALESCE(?, enabled),
                 api_format = COALESCE(?, api_format)
             WHERE id = ? AND source = 'predefined' AND (NOT ? OR api_key != '')
             RETURNING id, api_format, source, identifier, name, base_url,
                       api_key, api_path, models_path, models, enabled",
        )
        .bind(api_key)
        .bind(enabled)
        .bind(api_format)
        .bind(id)
        .bind(enabling_saved_key)
        .fetch_optional(&self.db)
        .await?
        .map(provider_row::from_tuple)
        .transpose()?
        .ok_or(missing_error)?;
        self.predefined_view(&updated, preset)
    }

    pub(super) fn predefined_view(
        &self,
        row: &ProviderRow,
        preset: &PredefinedProvider,
    ) -> Result<PredefinedProviderView, ProviderError> {
        Ok(PredefinedProviderView {
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
            api_key: self.open_key(&row.api_key)?,
            enabled: row.enabled,
        })
    }
}
