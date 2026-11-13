use uuid::Uuid;

use lemma_model::{ApiFormat, Connector, Endpoint};

use crate::preset;
use crate::provider_error::ProviderError;
use crate::provider_row::{self, ProviderRow, ProviderSource, ProviderTuple};

use super::provider_binding::ProviderBinding;
use super::providers::ProviderService;

impl<C: Connector> ProviderService<C> {
    /// Binds a provider for a turn and resolves its format and model features.
    ///
    /// A custom provider always uses its own format. A predefined provider uses
    /// `previous_api_format` when served, otherwise its stored default. A model
    /// absent from the provider's list has tool calling enabled.
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when no such provider or its predefined
    /// catalog entry exists, [`ProviderError::ApiFormatInvalid`] when a
    /// predefined format has no endpoint, [`ProviderError::Crypto`] when
    /// opening the key fails, and [`ProviderError::Store`] when the database
    /// fails.
    pub async fn bind(
        &self,
        id: Uuid,
        model: &str,
        previous_api_format: Option<ApiFormat>,
    ) -> Result<ProviderBinding<C::Adapter>, ProviderError> {
        let row = sqlx::query_as::<_, ProviderTuple>(
            "SELECT id, api_format, source, identifier, name, base_url,
                    api_key, api_path, models_path, models, enabled
             FROM providers
             WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.db)
        .await?
        .map(provider_row::from_tuple)
        .transpose()?
        .ok_or(ProviderError::NotFound)?;
        let (api_format, tool_calling) = match row.source {
            ProviderSource::Custom => (
                row.api_format,
                row.models
                    .iter()
                    .find(|entry| entry.id == model)
                    .is_none_or(|entry| entry.tool_calling),
            ),
            ProviderSource::Predefined => {
                let preset = preset::find(&row.identifier).ok_or(ProviderError::NotFound)?;
                let api_format = previous_api_format
                    .filter(|format| preset.serves(*format))
                    .unwrap_or(row.api_format);
                (api_format, preset.tool_calling(model))
            }
        };
        let endpoint = self.endpoint_from_row(&row, api_format)?;
        Ok(ProviderBinding {
            adapter: self.connector.connect(endpoint),
            api_format,
            tool_calling,
        })
    }

    pub(super) async fn endpoint(&self, id: Uuid) -> Result<Endpoint, ProviderError> {
        let row = sqlx::query_as::<_, ProviderTuple>(
            "SELECT id, api_format, source, identifier, name, base_url,
                    api_key, api_path, models_path, models, enabled
             FROM providers
             WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.db)
        .await?
        .map(provider_row::from_tuple)
        .transpose()?
        .ok_or(ProviderError::NotFound)?;
        self.endpoint_from_row(&row, row.api_format)
    }

    fn endpoint_from_row(
        &self,
        row: &ProviderRow,
        api_format: ApiFormat,
    ) -> Result<Endpoint, ProviderError> {
        let (base_url, api_path, models_path) = match row.source {
            ProviderSource::Custom => (
                row.base_url.clone(),
                row.api_path.clone(),
                row.models_path.clone(),
            ),
            ProviderSource::Predefined => {
                let preset = preset::find(&row.identifier).ok_or(ProviderError::NotFound)?;
                let base_url = preset
                    .base_url(api_format)
                    .ok_or(ProviderError::ApiFormatInvalid)?;
                (base_url.to_owned(), String::new(), String::new())
            }
        };
        Ok(Endpoint {
            api_format,
            api_key: self.open_key(&row.api_key)?,
            base_url,
            api_path,
            models_path,
        })
    }

    /// Fetches the live model list using a stored custom provider's key.
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when no such custom provider exists,
    /// [`ProviderError::Crypto`] when opening the key fails,
    /// [`ProviderError::Fetch`] when the endpoint request fails, and
    /// [`ProviderError::Store`] when the database fails.
    pub async fn fetch_models_for(&self, id: Uuid) -> Result<Vec<String>, ProviderError> {
        let row = self.find_custom(id).await?;
        let endpoint = self.endpoint_from_row(&row, row.api_format)?;
        self.fetch(endpoint).await
    }

    /// Fetches the live model list for ad-hoc custom connection details.
    ///
    /// # Errors
    ///
    /// [`ProviderError::Fetch`] when the endpoint request fails.
    pub async fn fetch_models_adhoc(
        &self,
        api_format: ApiFormat,
        base_url: &str,
        api_key: &str,
        models_path: &str,
    ) -> Result<Vec<String>, ProviderError> {
        self.fetch(Endpoint {
            api_format,
            base_url: base_url.trim().trim_end_matches('/').to_owned(),
            api_path: String::new(),
            models_path: models_path.trim().to_owned(),
            api_key: api_key.to_owned(),
        })
        .await
    }

    async fn fetch(&self, endpoint: Endpoint) -> Result<Vec<String>, ProviderError> {
        self.connector
            .list_models(endpoint)
            .await
            .map_err(|e| ProviderError::Fetch(e.message))
    }
}
