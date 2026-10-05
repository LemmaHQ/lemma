//! Provider domain service: validation, API-key sealing, and
//! orchestration over a [`ProviderStore`].

use std::str::FromStr;
use std::sync::Arc;

use chrono::{DateTime, Utc};
use lemma_crypto::{derive_key, mask, open, seal};
use uuid::Uuid;

use crate::error::ProviderError;
use crate::kind::ProviderKind;
use crate::models::fetch_models;
use crate::record::{NewProvider, ProviderPatch, ProviderRecord};
use crate::store::ProviderStore;

/// A provider as presented to callers: the API key is masked for
/// display.
#[derive(Debug, Clone)]
pub struct ProviderView {
    /// Provider id.
    pub id: Uuid,
    /// Provider kind.
    pub kind: ProviderKind,
    /// Display name.
    pub name: String,
    /// API base URL.
    pub base_url: String,
    /// Masked API key.
    pub api_key: String,
    /// Cached model ids.
    pub models: Vec<String>,
    /// Enabled flag.
    pub enabled: bool,
    /// Chat endpoint path override.
    pub api_path: String,
    /// Model-list endpoint path override.
    pub models_path: String,
    /// Creation time.
    pub created_at: DateTime<Utc>,
    /// Last update time.
    pub updated_at: DateTime<Utc>,
}

/// Input for creating a provider. `api_key` is plaintext.
pub struct CreateInput {
    /// Provider kind.
    pub kind: ProviderKind,
    /// Display name.
    pub name: String,
    /// API base URL.
    pub base_url: String,
    /// Plaintext API key.
    pub api_key: String,
    /// Chat endpoint path override.
    pub api_path: String,
    /// Model-list endpoint path override.
    pub models_path: String,
    /// Model ids to cache.
    pub models: Vec<String>,
}

/// Input for updating a provider. An absent or empty `api_key` keeps the
/// current key; a non-empty one is a plaintext replacement.
#[derive(Default)]
pub struct UpdateInput {
    /// Display name.
    pub name: Option<String>,
    /// API base URL.
    pub base_url: Option<String>,
    /// Plaintext replacement API key.
    pub api_key: Option<String>,
    /// Chat endpoint path override.
    pub api_path: Option<String>,
    /// Model-list endpoint path override.
    pub models_path: Option<String>,
    /// Enabled flag.
    pub enabled: Option<bool>,
    /// Model ids to cache.
    pub models: Option<Vec<String>>,
}

/// Provider domain service over a [`ProviderStore`] backend.
///
/// `secret_key` selects the API-key storage encoding: `Some` seals keys
/// with lemma-crypto (server), `None` stores plaintext (local storage
/// stays inspectable).
pub struct ProviderService {
    store: Arc<dyn ProviderStore>,
    secret_key: Option<Arc<str>>,
}

impl ProviderService {
    /// Creates the service over a store backend.
    pub fn new(store: Arc<dyn ProviderStore>, secret_key: Option<Arc<str>>) -> Self {
        Self { store, secret_key }
    }

    fn seal_key(&self, plain: &str) -> Result<String, ProviderError> {
        match &self.secret_key {
            Some(secret) => {
                seal(&derive_key(secret), plain).map_err(|e| ProviderError::Crypto(e.to_string()))
            }
            None => Ok(plain.to_string()),
        }
    }

    fn open_key(&self, stored: &str) -> Result<String, ProviderError> {
        match &self.secret_key {
            Some(secret) => {
                open(&derive_key(secret), stored).map_err(|e| ProviderError::Crypto(e.to_string()))
            }
            None => Ok(stored.to_string()),
        }
    }

    fn view(&self, r: &ProviderRecord) -> ProviderView {
        let api_key = self
            .open_key(&r.api_key)
            .map(|k| mask(&k))
            .unwrap_or_else(|_| "****".to_string());
        ProviderView {
            id: r.id,
            kind: ProviderKind::from_str(&r.kind).unwrap_or(ProviderKind::OpenAiCompatible),
            name: r.name.clone(),
            base_url: r.base_url.clone(),
            api_key,
            models: r.models.clone(),
            enabled: r.enabled,
            api_path: r.api_path.clone(),
            models_path: r.models_path.clone(),
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }

    /// Lists the user's providers with masked keys.
    pub async fn list(&self, user_id: Uuid) -> Result<Vec<ProviderView>, ProviderError> {
        let records = self.store.list(user_id).await?;
        Ok(records.iter().map(|r| self.view(r)).collect())
    }

    /// Validates and stores a new provider.
    pub async fn create(
        &self,
        user_id: Uuid,
        input: CreateInput,
    ) -> Result<ProviderView, ProviderError> {
        let kind = input.kind.as_str();
        let name = input.name.trim();
        let base_url = input.base_url.trim().trim_end_matches('/');
        if name.is_empty() || base_url.is_empty() || input.api_key.is_empty() {
            return Err(ProviderError::FieldsRequired);
        }
        let sealed = self.seal_key(&input.api_key)?;
        let record = self
            .store
            .insert(
                user_id,
                &NewProvider {
                    id: Uuid::new_v4(),
                    kind: kind.to_string(),
                    name: name.to_string(),
                    base_url: base_url.to_string(),
                    api_key: sealed,
                    api_path: input.api_path.trim().to_string(),
                    models_path: input.models_path.trim().to_string(),
                    models: input.models,
                },
            )
            .await?;
        Ok(self.view(&record))
    }

    /// Applies an update to a provider owned by the user.
    pub async fn update(
        &self,
        user_id: Uuid,
        id: Uuid,
        input: UpdateInput,
    ) -> Result<ProviderView, ProviderError> {
        let api_key = match input.api_key {
            Some(k) if !k.is_empty() => Some(self.seal_key(&k)?),
            _ => None,
        };
        let patch = ProviderPatch {
            name: input.name.map(|s| s.trim().to_string()),
            base_url: input
                .base_url
                .map(|s| s.trim().trim_end_matches('/').to_string()),
            api_key,
            api_path: input.api_path.map(|s| s.trim().to_string()),
            models_path: input.models_path.map(|s| s.trim().to_string()),
            enabled: input.enabled,
            models: input.models,
        };
        let record = self
            .store
            .update(user_id, id, patch)
            .await?
            .ok_or(ProviderError::NotFound)?;
        Ok(self.view(&record))
    }

    /// Deletes a provider owned by the user.
    pub async fn delete(&self, user_id: Uuid, id: Uuid) -> Result<(), ProviderError> {
        if !self.store.delete(user_id, id).await? {
            return Err(ProviderError::NotFound);
        }
        Ok(())
    }

    /// Fetches the live model list using a stored provider's key.
    pub async fn fetch_models_for(
        &self,
        user_id: Uuid,
        id: Uuid,
    ) -> Result<Vec<String>, ProviderError> {
        let record = self
            .store
            .get(user_id, id)
            .await?
            .ok_or(ProviderError::NotFound)?;
        let plain = self.open_key(&record.api_key)?;
        fetch_models(
            ProviderKind::from_str(&record.kind).unwrap_or(ProviderKind::OpenAiCompatible),
            &record.base_url,
            &plain,
            &record.models_path,
        )
        .await
        .map_err(ProviderError::Fetch)
    }

    /// Fetches the live model list for ad-hoc connection details.
    pub async fn fetch_models_adhoc(
        &self,
        kind: ProviderKind,
        base_url: &str,
        api_key: &str,
        models_path: &str,
    ) -> Result<Vec<String>, ProviderError> {
        fetch_models(
            kind,
            base_url.trim().trim_end_matches('/'),
            api_key,
            models_path.trim(),
        )
        .await
        .map_err(ProviderError::Fetch)
    }
}
