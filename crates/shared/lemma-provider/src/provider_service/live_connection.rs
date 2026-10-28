use lemma_model::{Connector, Endpoint, ProviderKind};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use uuid::Uuid;

use crate::entity::provider;
use crate::provider_error::ProviderError;

use super::providers::{self, ProviderService};

impl<C: Connector> ProviderService<C> {
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

    pub(super) async fn endpoint(
        &self,
        user_id: Uuid,
        id: Uuid,
    ) -> Result<Endpoint, ProviderError> {
        let row = provider::Entity::find_by_id(id)
            .filter(provider::Column::UserId.eq(user_id))
            .one(&self.db)
            .await?
            .ok_or(ProviderError::NotFound)?;
        Ok(Endpoint {
            kind: providers::kind_of(&row),
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
