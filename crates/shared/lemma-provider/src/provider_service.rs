//! Provider domain service: validation, API-key sealing, and persistence
//! over a database.

use std::fmt::{self, Debug};

use chrono::{DateTime, Utc};
use lemma_model::{Connector, Endpoint, ProviderKind};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, DbErr, EntityTrait, NotSet, QueryFilter,
    QueryOrder, Set, SqlErr, Unchanged,
};
use uuid::Uuid;

use crate::entity::provider;
use crate::entity::provider::Models;
use crate::provider_error::ProviderError;

/// A provider as presented to callers: the API key is opened to plaintext.
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
    /// Plaintext API key; empty when none is stored or the stored one
    /// cannot be opened.
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

/// Input for updating a provider. A `None` field keeps its current value;
/// `Some` replaces it, and an empty `api_key` clears the key.
#[derive(Debug, Default)]
pub struct UpdateInput {
    /// Display name.
    pub name: Option<String>,
    /// API base URL.
    pub base_url: Option<String>,
    /// Plaintext replacement API key; empty clears the key.
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

/// Provider domain service over a database holding the providers table.
///
/// `secret_key` selects the API-key storage encoding: `Some` seals keys
/// with lemma-crypto (server), `None` stores plaintext (local storage
/// stays inspectable). `connector` binds providers to adapters and fetches
/// live model lists.
pub struct ProviderService<C> {
    db: DatabaseConnection,
    secret_key: Option<String>,
    connector: C,
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
    pub fn new(db: DatabaseConnection, secret_key: Option<String>, connector: C) -> Self {
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
            created_at: r.created_at,
            updated_at: r.updated_at,
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
            updated_at: Set(now),
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
        let row = provider::Entity::update(provider::ActiveModel {
            id: Unchanged(id),
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
            updated_at: Set(Utc::now()),
            ..Default::default()
        })
        .validate()?
        .filter(provider::Column::UserId.eq(user_id))
        .exec(&self.db)
        .await
        .map_err(|e| match e {
            DbErr::RecordNotUpdated => ProviderError::NotFound,
            e => e.into(),
        })?;
        Ok(self.view(&row))
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

    /// Returns the adapter of a stored provider, bound to its connection
    /// details with the API key opened.
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when the user owns no such provider,
    /// [`ProviderError::Crypto`] when opening the key fails, and
    /// [`ProviderError::Store`] when the database fails.
    pub async fn adapter(&self, user_id: Uuid, id: Uuid) -> Result<C::Adapter, ProviderError> {
        let endpoint = self.endpoint(user_id, id).await?;
        Ok(self.connector.connect(endpoint))
    }

    async fn endpoint(&self, user_id: Uuid, id: Uuid) -> Result<Endpoint, ProviderError> {
        let row = provider::Entity::find_by_id(id)
            .filter(provider::Column::UserId.eq(user_id))
            .one(&self.db)
            .await?
            .ok_or(ProviderError::NotFound)?;
        Ok(Endpoint {
            kind: kind_of(&row),
            api_key: self.open_key(&row.api_key)?,
            base_url: row.base_url,
            api_path: row.api_path,
            models_path: row.models_path,
        })
    }

    /// Fetches the live model list using a stored provider's key.
    ///
    /// # Errors
    ///
    /// [`ProviderError::NotFound`] when the user owns no such provider,
    /// [`ProviderError::Crypto`] when opening the key fails,
    /// [`ProviderError::Fetch`] when the endpoint request fails, and
    /// [`ProviderError::Store`] when the database fails.
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

fn kind_of(row: &provider::Model) -> ProviderKind {
    use std::str::FromStr;

    ProviderKind::from_str(&row.kind).unwrap_or(ProviderKind::OpenAiCompatible)
}
