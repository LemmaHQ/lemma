//! Provider domain service: validation, API-key sealing, and
//! orchestration over a [`ProviderStore`].

use std::fmt::{self, Debug};

use chrono::{DateTime, Utc};
use lemma_model::{Connector, Endpoint, ProviderKind};
use uuid::Uuid;

use crate::provider_error::ProviderError;
use crate::provider_store::ProviderStore;
use crate::record::{NewProvider, ProviderPatch, ProviderRecord};

/// A provider as presented to callers: the API key is masked for
/// display.
#[derive(Debug, Clone)]
pub struct ProviderView {
    /// Provider id.
    pub id: Uuid,
    /// Provider kind.
    pub kind: ProviderKind,
    /// User-facing machine identifier, ASCII-only, immutable after creation.
    pub identifier: String,
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
    /// Generation endpoint path override.
    pub api_path: String,
    /// Model-list endpoint path override.
    pub models_path: String,
    /// Creation time.
    pub created_at: DateTime<Utc>,
    /// Last update time.
    pub updated_at: DateTime<Utc>,
}

/// Input for creating a provider. `api_key` is plaintext.
#[derive(Debug)]
pub struct CreateInput {
    /// Provider kind.
    pub kind: ProviderKind,
    /// User-facing machine identifier, ASCII-only, immutable after creation.
    pub identifier: String,
    /// Display name.
    pub name: String,
    /// API base URL.
    pub base_url: String,
    /// Plaintext API key.
    pub api_key: String,
    /// Generation endpoint path override.
    pub api_path: String,
    /// Model-list endpoint path override.
    pub models_path: String,
    /// Model ids to cache.
    pub models: Vec<String>,
}

/// Input for updating a provider. An absent or empty `api_key` keeps the
/// current key; a non-empty one is a plaintext replacement.
#[derive(Debug, Default)]
pub struct UpdateInput {
    /// Display name.
    pub name: Option<String>,
    /// API base URL.
    pub base_url: Option<String>,
    /// Plaintext replacement API key.
    pub api_key: Option<String>,
    /// Generation endpoint path override.
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
/// stays inspectable). `connector` binds providers to adapters and fetches
/// live model lists.
pub struct ProviderService<P, C> {
    store: P,
    secret_key: Option<String>,
    connector: C,
}

impl<P: Debug, C: Debug> Debug for ProviderService<P, C> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ProviderService")
            .field("store", &self.store)
            .field("connector", &self.connector)
            .finish_non_exhaustive()
    }
}

impl<P: ProviderStore, C: Connector> ProviderService<P, C> {
    /// Creates the service over a store backend.
    pub fn new(store: P, secret_key: Option<String>, connector: C) -> Self {
        Self {
            store,
            secret_key,
            connector,
        }
    }

    fn seal_key(&self, plain: &str) -> Result<String, ProviderError> {
        if plain.is_empty() {
            return Ok(String::new());
        }
        match &self.secret_key {
            Some(secret) => lemma_crypto::seal(&lemma_crypto::derive_key(secret), plain)
                .map_err(|e| ProviderError::Crypto(e.to_string())),
            None => Ok(plain.to_string()),
        }
    }

    fn open_key(&self, stored: &str) -> Result<String, ProviderError> {
        if stored.is_empty() {
            return Ok(String::new());
        }
        match &self.secret_key {
            Some(secret) => lemma_crypto::open(&lemma_crypto::derive_key(secret), stored)
                .map_err(|e| ProviderError::Crypto(e.to_string())),
            None => Ok(stored.to_string()),
        }
    }

    fn view(&self, r: &ProviderRecord) -> ProviderView {
        let api_key = self.open_key(&r.api_key).unwrap_or_default();
        ProviderView {
            id: r.id,
            kind: kind_of(r),
            identifier: r.identifier.clone(),
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
    ///
    /// # Errors
    ///
    /// Propagates the store's [`ProviderError`].
    pub async fn list(&self, user_id: Uuid) -> Result<Vec<ProviderView>, ProviderError> {
        let records = self.store.list(user_id).await?;
        Ok(records.iter().map(|r| self.view(r)).collect())
    }

    /// Validates and stores a new provider.
    ///
    /// # Errors
    ///
    /// [`ProviderError::IdentifierInvalid`] for an empty or non-ASCII
    /// identifier, [`ProviderError::FieldsRequired`] for an empty base URL,
    /// [`ProviderError::Crypto`] when sealing the key fails; otherwise
    /// propagates the store's error.
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
        let record = self
            .store
            .insert(
                user_id,
                &NewProvider {
                    id: Uuid::new_v4(),
                    kind: kind.to_string(),
                    identifier: identifier.to_string(),
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
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when the user owns no such provider,
    /// [`ProviderError::Crypto`] when sealing the key fails; otherwise
    /// propagates the store's error.
    pub async fn update(
        &self,
        user_id: Uuid,
        id: Uuid,
        input: UpdateInput,
    ) -> Result<ProviderView, ProviderError> {
        let api_key = match input.api_key {
            Some(k) => Some(self.seal_key(&k)?),
            None => None,
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
            .update(user_id, id, &patch)
            .await?
            .ok_or(ProviderError::NotFound)?;
        Ok(self.view(&record))
    }

    /// Deletes a provider owned by the user.
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when the user owns no such provider;
    /// otherwise propagates the store's error.
    pub async fn delete(&self, user_id: Uuid, id: Uuid) -> Result<(), ProviderError> {
        if !self.store.delete(user_id, id).await? {
            return Err(ProviderError::NotFound);
        }
        Ok(())
    }

    /// Returns the adapter of a stored provider, bound to its connection
    /// details with the API key opened.
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when the user owns no such provider,
    /// [`ProviderError::Crypto`] when opening the key fails; otherwise
    /// propagates the store's error.
    pub async fn adapter(&self, user_id: Uuid, id: Uuid) -> Result<C::Adapter, ProviderError> {
        let endpoint = self.endpoint(user_id, id).await?;
        Ok(self.connector.connect(endpoint))
    }

    async fn endpoint(&self, user_id: Uuid, id: Uuid) -> Result<Endpoint, ProviderError> {
        let record = self
            .store
            .get(user_id, id)
            .await?
            .ok_or(ProviderError::NotFound)?;
        Ok(Endpoint {
            kind: kind_of(&record),
            api_key: self.open_key(&record.api_key)?,
            base_url: record.base_url,
            api_path: record.api_path,
            models_path: record.models_path,
        })
    }

    /// Fetches the live model list using a stored provider's key.
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when the user owns no such provider,
    /// [`ProviderError::Crypto`] when opening the key fails,
    /// [`ProviderError::Fetch`] when the endpoint request fails; otherwise
    /// propagates the store's error.
    pub async fn fetch_models_for(
        &self,
        user_id: Uuid,
        id: Uuid,
    ) -> Result<Vec<String>, ProviderError> {
        let endpoint = self.endpoint(user_id, id).await?;
        self.fetch(endpoint).await
    }

    /// Fetches the live model list for ad-hoc connection details.
    ///
    /// # Errors
    ///
    /// [`ProviderError::Fetch`] when the endpoint request fails.
    pub async fn fetch_models_adhoc(
        &self,
        kind: ProviderKind,
        base_url: &str,
        api_key: &str,
        models_path: &str,
    ) -> Result<Vec<String>, ProviderError> {
        self.fetch(Endpoint {
            kind,
            base_url: base_url.trim().trim_end_matches('/').to_string(),
            api_path: String::new(),
            models_path: models_path.trim().to_string(),
            api_key: api_key.to_string(),
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

fn kind_of(record: &ProviderRecord) -> ProviderKind {
    use std::str::FromStr;

    ProviderKind::from_str(&record.kind).unwrap_or(ProviderKind::OpenAiCompatible)
}
