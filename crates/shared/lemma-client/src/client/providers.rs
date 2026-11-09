use lemma_proto::lemma::v1::{
    CheckProviderRequest, CreateProviderRequest, DeleteProviderRequest, FetchModelsRequest,
    ListProvidersRequest, Provider, UpdateProviderRequest,
};

use crate::client::Client;
use crate::client_error::ClientError;
use crate::token_store::TokenStore;

impl<S: TokenStore> Client<S> {
    /// The user's providers.
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`].
    pub async fn list_providers(&self) -> Result<Vec<Provider>, ClientError> {
        let providers = &self.inner.providers;
        let response = self
            .authorized(|options| {
                let request = ListProvidersRequest::default();
                providers.list_providers_with_options(request, options)
            })
            .await?;
        Ok(response.into_owned().providers)
    }

    /// Creates a provider.
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`].
    pub async fn create_provider(
        &self,
        request: CreateProviderRequest,
    ) -> Result<Provider, ClientError> {
        let providers = &self.inner.providers;
        let response = self
            .authorized(|options| providers.create_provider_with_options(request.clone(), options))
            .await?;
        Ok(response
            .into_owned()
            .provider
            .into_option()
            .unwrap_or_default())
    }

    /// Changes the fields a provider update sets.
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`].
    pub async fn update_provider(
        &self,
        request: UpdateProviderRequest,
    ) -> Result<Provider, ClientError> {
        let providers = &self.inner.providers;
        let response = self
            .authorized(|options| providers.update_provider_with_options(request.clone(), options))
            .await?;
        Ok(response
            .into_owned()
            .provider
            .into_option()
            .unwrap_or_default())
    }

    /// Deletes a provider.
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`].
    pub async fn delete_provider(&self, id: &str) -> Result<(), ClientError> {
        let providers = &self.inner.providers;
        self.authorized(|options| {
            let request = DeleteProviderRequest {
                id: id.to_owned(),
                ..Default::default()
            };
            providers.delete_provider_with_options(request, options)
        })
        .await?;
        Ok(())
    }

    /// The model ids a stored or unsaved provider's endpoint lists.
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`].
    pub async fn fetch_models(
        &self,
        request: FetchModelsRequest,
    ) -> Result<Vec<String>, ClientError> {
        let providers = &self.inner.providers;
        let response = self
            .authorized(|options| providers.fetch_models_with_options(request.clone(), options))
            .await?;
        Ok(response.into_owned().models)
    }

    /// Sends a test request to a provider's model: `None` when it answers, else the failure text.
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`].
    pub async fn check_provider(
        &self,
        request: CheckProviderRequest,
    ) -> Result<Option<String>, ClientError> {
        let providers = &self.inner.providers;
        let response = self
            .authorized(|options| providers.check_provider_with_options(request.clone(), options))
            .await?;
        let error = response.into_owned().error;
        Ok((!error.is_empty()).then_some(error))
    }
}
