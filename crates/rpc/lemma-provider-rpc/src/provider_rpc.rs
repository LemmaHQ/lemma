use std::fmt::{self, Debug};
use std::sync::Arc;

use connectrpc::{RequestContext, Response, ServiceRequest, ServiceResult};
use lemma_model::{Connector, Endpoint};
use lemma_proto::lemma::v1;
use lemma_proto::lemma::v1::{
    CheckProviderRequest, CheckProviderResponse, CreateCustomProviderRequest,
    CreateCustomProviderResponse, DeleteCustomProviderRequest, DeleteCustomProviderResponse,
    ErrorReason, FetchModelsRequest, FetchModelsResponse, ListProvidersRequest,
    ListProvidersResponse, ListWebProvidersRequest, ListWebProvidersResponse,
    SetWebProviderOrderRequest, SetWebProviderOrderResponse, UpdateCustomProviderRequest,
    UpdateCustomProviderResponse, UpdatePredefinedProviderRequest,
    UpdatePredefinedProviderResponse, UpdateWebProviderRequest, UpdateWebProviderResponse,
};
use lemma_provider::{
    CreateCustomInput, ProviderError, ProviderService, ProviderView, UpdateCustomInput,
    UpdatePredefinedInput, UpdateWebInput,
};

use crate::provider_mapping::{
    adhoc_format, map_domain, models_from_proto, parse_id, to_proto, web_function_from_proto,
    web_to_proto,
};

/// Connect handler implementing the `ProviderService` RPCs.
///
/// `jwt_secret` authenticates requests; `domain` seals API keys at rest
/// and fetches model lists.
pub struct ProviderRpc<C> {
    domain: Arc<ProviderService<C>>,
    jwt_secret: String,
}

impl<C: Debug> Debug for ProviderRpc<C> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ProviderRpc")
            .field("domain", &self.domain)
            .finish_non_exhaustive()
    }
}

impl<C: Connector> ProviderRpc<C> {
    /// Creates the handler over the provider domain service, which the
    /// agent shares.
    pub fn new(domain: Arc<ProviderService<C>>, jwt_secret: String) -> Self {
        Self { domain, jwt_secret }
    }
}

#[allow(refining_impl_trait)]
impl<C: Connector> v1::ProviderService for ProviderRpc<C> {
    async fn list_providers(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, ListProvidersRequest>,
    ) -> ServiceResult<ListProvidersResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let providers = self.domain.list(user_id).await.map_err(map_domain)?;
        Response::ok(ListProvidersResponse {
            providers: providers.into_iter().map(to_proto).collect(),
            ..Default::default()
        })
    }

    async fn create_custom_provider(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, CreateCustomProviderRequest>,
    ) -> ServiceResult<CreateCustomProviderResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let input = CreateCustomInput {
            api_format: adhoc_format(request.api_format.as_known())?,
            identifier: request.identifier.to_string(),
            name: request.name.to_string(),
            base_url: request.base_url.to_string(),
            api_key: request.api_key.to_string(),
            api_path: request.api_path.to_string(),
            models_path: request.models_path.to_string(),
            models: models_from_proto(request.models.iter()),
        };
        let provider = self
            .domain
            .create_custom(user_id, input)
            .await
            .map_err(map_domain)?;
        Response::ok(CreateCustomProviderResponse {
            provider: to_proto(ProviderView::Custom(provider)).into(),
            ..Default::default()
        })
    }

    async fn update_custom_provider(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, UpdateCustomProviderRequest>,
    ) -> ServiceResult<UpdateCustomProviderResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let input = UpdateCustomInput {
            name: request.name.map(ToString::to_string),
            base_url: request.base_url.map(ToString::to_string),
            api_key: request.api_key.map(ToString::to_string),
            api_path: request.api_path.map(ToString::to_string),
            models_path: request.models_path.map(ToString::to_string),
            enabled: request.enabled,
            models: request
                .models
                .as_option()
                .map(|patch| models_from_proto(patch.models.iter())),
        };
        let provider = self
            .domain
            .update_custom(user_id, parse_id(request.id)?, input)
            .await
            .map_err(map_domain)?;
        Response::ok(UpdateCustomProviderResponse {
            provider: to_proto(ProviderView::Custom(provider)).into(),
            ..Default::default()
        })
    }

    async fn update_predefined_provider(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, UpdatePredefinedProviderRequest>,
    ) -> ServiceResult<UpdatePredefinedProviderResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let default_api_format = request
            .default_api_format
            .map(|format| adhoc_format(format.as_known()))
            .transpose()?;
        let input = UpdatePredefinedInput {
            api_key: request.api_key.map(ToString::to_string),
            enabled: request.enabled,
            default_api_format,
        };
        let provider = self
            .domain
            .update_predefined(user_id, parse_id(request.id)?, input)
            .await
            .map_err(map_domain)?;
        Response::ok(UpdatePredefinedProviderResponse {
            provider: to_proto(ProviderView::Predefined(provider)).into(),
            ..Default::default()
        })
    }

    async fn delete_custom_provider(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, DeleteCustomProviderRequest>,
    ) -> ServiceResult<DeleteCustomProviderResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        self.domain
            .delete_custom(user_id, parse_id(request.id)?)
            .await
            .map_err(map_domain)?;
        Response::ok(DeleteCustomProviderResponse::default())
    }

    async fn fetch_models(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, FetchModelsRequest>,
    ) -> ServiceResult<FetchModelsResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let models = if request.id.is_empty() {
            let format = adhoc_format(request.api_format.as_known())?;
            self.domain
                .fetch_models_adhoc(
                    format,
                    request.base_url,
                    request.api_key,
                    request.models_path,
                )
                .await
        } else {
            self.domain
                .fetch_models_for(user_id, parse_id(request.id)?)
                .await
        }
        .map_err(map_domain)?;
        Response::ok(FetchModelsResponse {
            models,
            ..Default::default()
        })
    }

    async fn check_provider(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, CheckProviderRequest>,
    ) -> ServiceResult<CheckProviderResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        if request.model.trim().is_empty() {
            return Err(lemma_proto::app_error(ErrorReason::ModelRequired));
        }
        let model = request.model.trim();
        let checked = if request.id.is_empty() {
            let format = adhoc_format(request.api_format.as_known())?;
            let endpoint = Endpoint {
                api_format: format,
                base_url: request.base_url.to_owned(),
                api_key: request.api_key.to_owned(),
                api_path: request.api_path.to_owned(),
                models_path: String::new(),
            };
            self.domain.check_adhoc(endpoint, model).await
        } else {
            self.domain
                .check_for(user_id, parse_id(request.id)?, model)
                .await
        };
        let error = match checked {
            Ok(()) => String::new(),
            Err(ProviderError::Check(message)) => message,
            Err(e) => return Err(map_domain(e)),
        };
        Response::ok(CheckProviderResponse {
            error,
            ..Default::default()
        })
    }

    async fn list_web_providers(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, ListWebProvidersRequest>,
    ) -> ServiceResult<ListWebProvidersResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let providers = self.domain.list_web(user_id).await.map_err(map_domain)?;
        Response::ok(ListWebProvidersResponse {
            providers: providers.into_iter().map(web_to_proto).collect(),
            ..Default::default()
        })
    }

    async fn update_web_provider(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, UpdateWebProviderRequest>,
    ) -> ServiceResult<UpdateWebProviderResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let input = UpdateWebInput {
            api_key: request.api_key.map(ToString::to_string),
            enabled: request.enabled,
        };
        let provider = self
            .domain
            .update_web(user_id, parse_id(request.id)?, input)
            .await
            .map_err(map_domain)?;
        Response::ok(UpdateWebProviderResponse {
            provider: web_to_proto(provider).into(),
            ..Default::default()
        })
    }

    async fn set_web_provider_order(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, SetWebProviderOrderRequest>,
    ) -> ServiceResult<SetWebProviderOrderResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let function = web_function_from_proto(request.function.as_known())?;
        let ids = request
            .ids
            .iter()
            .map(|id| parse_id(id))
            .collect::<Result<_, _>>()?;
        let providers = self
            .domain
            .set_web_order(user_id, function, ids)
            .await
            .map_err(map_domain)?;
        Response::ok(SetWebProviderOrderResponse {
            providers: providers.into_iter().map(web_to_proto).collect(),
            ..Default::default()
        })
    }
}
