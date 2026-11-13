use std::fmt::{self, Debug};

use chrono::Utc;
use sqlx::SqlitePool;
use sqlx::types::Json;
use uuid::Uuid;

use lemma_model::Connector;

use crate::preset::{self, PredefinedProvider};
use crate::provider_error::ProviderError;
use crate::provider_model::ProviderModel;
use crate::provider_row::{self, ProviderRow, ProviderSource, ProviderTuple};

use super::create_input::CreateCustomInput;
use super::provider_view::{CustomProviderView, PredefinedProviderView, ProviderView};
use super::update_input::UpdateCustomInput;

/// Provider domain service over a SQLite pool holding the `providers` and
/// `web_providers` tables.
///
/// `secret_key` derives the key that seals API keys with `lemma-crypto`.
/// `connector` binds providers to adapters and fetches live model lists.
pub struct ProviderService<C> {
    pub(super) db: SqlitePool,
    key: [u8; 32],
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
    /// Creates the service over a SQLite pool.
    #[must_use]
    pub fn new(db: SqlitePool, secret_key: &str, connector: C) -> Self {
        Self {
            db,
            key: lemma_crypto::derive_key(secret_key),
            connector,
        }
    }

    pub(super) fn seal_key(&self, plain: &str) -> Result<String, ProviderError> {
        if plain.is_empty() {
            return Ok(String::new());
        }
        lemma_crypto::seal(&self.key, plain).map_err(ProviderError::Crypto)
    }

    pub(super) fn open_key(&self, stored: &str) -> Result<String, ProviderError> {
        if stored.is_empty() {
            return Ok(String::new());
        }
        lemma_crypto::open(&self.key, stored).map_err(ProviderError::Crypto)
    }

    pub(super) fn view(row: &ProviderRow) -> Option<ProviderView> {
        match row.source {
            ProviderSource::Custom => Some(ProviderView::Custom(Self::custom_view(row))),
            ProviderSource::Predefined => {
                let preset = preset::find(&row.identifier)?;
                Some(ProviderView::Predefined(Self::predefined_view(row, preset)))
            }
        }
    }

    pub(super) fn predefined_view(
        row: &ProviderRow,
        preset: &PredefinedProvider,
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
            has_key: !row.api_key.is_empty(),
            enabled: row.enabled,
        }
    }

    fn custom_view(row: &ProviderRow) -> CustomProviderView {
        CustomProviderView {
            id: row.id,
            identifier: row.identifier.clone(),
            name: row.name.clone(),
            api_format: row.api_format,
            base_url: row.base_url.clone(),
            has_key: !row.api_key.is_empty(),
            models: row.models.clone(),
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
    pub async fn list(&self) -> Result<Vec<ProviderView>, ProviderError> {
        self.insert_missing_predefined().await?;
        let tuples = sqlx::query_as::<_, ProviderTuple>(
            "SELECT id, api_format, source, identifier, name, base_url,
                    api_key, api_path, models_path, models, enabled
             FROM providers
             ORDER BY created_at ASC, id ASC",
        )
        .fetch_all(&self.db)
        .await?;
        let rows: Vec<ProviderRow> = tuples
            .into_iter()
            .map(provider_row::from_tuple)
            .collect::<Result<_, _>>()?;
        let mut views: Vec<_> = rows.iter().filter_map(Self::view).collect();
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
        let id = Uuid::new_v4();
        let api_path = input.api_path.trim().to_owned();
        let models_path = input.models_path.trim().to_owned();
        sqlx::query(
            "INSERT INTO providers (
                 id, api_format, source, identifier, name, base_url,
                 api_key, api_path, models_path, models, enabled, created_at
             )
             VALUES (?, ?, 'custom', ?, ?, ?, ?, ?, ?, ?, 1, ?)",
        )
        .bind(id)
        .bind(provider_row::api_format_str(input.api_format))
        .bind(identifier)
        .bind(name)
        .bind(base_url)
        .bind(&sealed)
        .bind(&api_path)
        .bind(&models_path)
        .bind(Json(&input.models))
        .bind(Utc::now())
        .execute(&self.db)
        .await
        .map_err(|e| {
            if e.as_database_error()
                .is_some_and(|db_err| db_err.is_unique_violation())
            {
                ProviderError::IdentifierTaken
            } else {
                e.into()
            }
        })?;
        Ok(CustomProviderView {
            id,
            identifier: identifier.to_owned(),
            name: name.to_owned(),
            api_format: input.api_format,
            base_url: base_url.to_owned(),
            has_key: !input.api_key.is_empty(),
            models: input.models,
            enabled: true,
            api_path,
            models_path,
        })
    }

    /// Applies an update to a custom provider.
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when no such custom provider exists,
    /// [`ProviderError::Crypto`] when sealing fails, and [`ProviderError::Store`]
    /// when the database fails.
    pub async fn update_custom(
        &self,
        id: Uuid,
        input: UpdateCustomInput,
    ) -> Result<CustomProviderView, ProviderError> {
        let name = input.name.map(|s| s.trim().to_owned());
        let base_url = input
            .base_url
            .map(|s| s.trim().trim_end_matches('/').to_owned());
        let api_key = input
            .api_key
            .as_deref()
            .map(|key| self.seal_key(key))
            .transpose()?;
        let api_path = input.api_path.map(|s| s.trim().to_owned());
        let models_path = input.models_path.map(|s| s.trim().to_owned());
        let models = input.models.map(Json);
        let row = sqlx::query_as::<_, ProviderTuple>(
            "UPDATE providers
             SET name = COALESCE(?, name),
                 base_url = COALESCE(?, base_url),
                 api_key = COALESCE(?, api_key),
                 api_path = COALESCE(?, api_path),
                 models_path = COALESCE(?, models_path),
                 models = COALESCE(?, models),
                 enabled = COALESCE(?, enabled)
             WHERE id = ? AND source = 'custom'
             RETURNING id, api_format, source, identifier, name, base_url,
                       api_key, api_path, models_path, models, enabled",
        )
        .bind(name)
        .bind(base_url)
        .bind(api_key)
        .bind(api_path)
        .bind(models_path)
        .bind(models)
        .bind(input.enabled)
        .bind(id)
        .fetch_optional(&self.db)
        .await?
        .map(provider_row::from_tuple)
        .transpose()?
        .ok_or(ProviderError::NotFound)?;
        Ok(Self::custom_view(&row))
    }

    /// Deletes a custom provider.
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when no such custom provider exists and
    /// [`ProviderError::Store`] when the database fails.
    pub async fn delete_custom(&self, id: Uuid) -> Result<(), ProviderError> {
        let deleted = sqlx::query("DELETE FROM providers WHERE id = ? AND source = 'custom'")
            .bind(id)
            .execute(&self.db)
            .await?;
        if deleted.rows_affected() == 0 {
            return Err(ProviderError::NotFound);
        }
        Ok(())
    }

    pub(super) async fn find_row(&self, id: Uuid) -> Result<ProviderRow, ProviderError> {
        sqlx::query_as::<_, ProviderTuple>(
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
        .ok_or(ProviderError::NotFound)
    }
}
