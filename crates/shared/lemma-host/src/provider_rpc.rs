use std::sync::Arc;

use connectrpc::{RequestContext, Response, ServiceRequest, ServiceResult};
use lemma_model::Connector;
use lemma_proto::lemma::v1;
use lemma_proto::lemma::v1::{
    CheckProviderRequest, CheckProviderResponse, CreateCustomProviderRequest,
    CreateCustomProviderResponse, DeleteCustomProviderRequest, DeleteCustomProviderResponse,
    FetchModelsRequest, FetchModelsResponse, ListProvidersRequest, ListProvidersResponse,
    ListWebProvidersRequest, ListWebProvidersResponse, SetWebProviderOrderRequest,
    SetWebProviderOrderResponse, UpdateCustomProviderRequest, UpdateCustomProviderResponse,
    UpdatePredefinedProviderRequest, UpdatePredefinedProviderResponse, UpdateWebProviderRequest,
    UpdateWebProviderResponse,
};
use lemma_provider::{
    CreateCustomInput, ProviderError, ProviderService, ProviderView, UpdateCustomInput,
    UpdatePredefinedInput, UpdateWebInput,
};

use crate::parse_id::parse_id;
use crate::provider_mapping::{
    map_domain, models_from_proto, require_format, to_proto, web_function_from_proto, web_to_proto,
};

#[derive(Debug)]
pub(crate) struct ProviderRpc<C> {
    domain: Arc<ProviderService<C>>,
}

impl<C: Connector> ProviderRpc<C> {
    #[must_use]
    pub(crate) fn new(domain: Arc<ProviderService<C>>) -> Self {
        Self { domain }
    }
}

#[allow(refining_impl_trait)]
impl<C: Connector> v1::ProviderService for ProviderRpc<C> {
    async fn list_providers(
        &self,
        _ctx: RequestContext,
        _request: ServiceRequest<'_, ListProvidersRequest>,
    ) -> ServiceResult<ListProvidersResponse> {
        let providers = self.domain.list().await.map_err(map_domain)?;
        Response::ok(ListProvidersResponse {
            providers: providers.into_iter().map(to_proto).collect(),
            ..Default::default()
        })
    }

    async fn create_custom_provider(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, CreateCustomProviderRequest>,
    ) -> ServiceResult<CreateCustomProviderResponse> {
        let input = CreateCustomInput {
            api_format: require_format(request.api_format.as_known())?,
            identifier: request.identifier.to_string(),
            name: request.name.to_string(),
            base_url: request.base_url.to_string(),
            api_key: request.api_key.to_string(),
            api_path: request.api_path.to_string(),
            models_path: request.models_path.to_string(),
            models: models_from_proto(request.models.iter()),
        };
        let provider = self.domain.create_custom(input).await.map_err(map_domain)?;
        Response::ok(CreateCustomProviderResponse {
            provider: to_proto(ProviderView::Custom(provider)).into(),
            ..Default::default()
        })
    }

    async fn update_custom_provider(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, UpdateCustomProviderRequest>,
    ) -> ServiceResult<UpdateCustomProviderResponse> {
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
            .update_custom(parse_id(request.id)?, input)
            .await
            .map_err(map_domain)?;
        Response::ok(UpdateCustomProviderResponse {
            provider: to_proto(ProviderView::Custom(provider)).into(),
            ..Default::default()
        })
    }

    async fn update_predefined_provider(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, UpdatePredefinedProviderRequest>,
    ) -> ServiceResult<UpdatePredefinedProviderResponse> {
        let default_api_format = request
            .default_api_format
            .map(|format| require_format(format.as_known()))
            .transpose()?;
        let input = UpdatePredefinedInput {
            api_key: request.api_key.map(ToString::to_string),
            enabled: request.enabled,
            default_api_format,
        };
        let provider = self
            .domain
            .update_predefined(parse_id(request.id)?, input)
            .await
            .map_err(map_domain)?;
        Response::ok(UpdatePredefinedProviderResponse {
            provider: to_proto(ProviderView::Predefined(provider)).into(),
            ..Default::default()
        })
    }

    async fn delete_custom_provider(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, DeleteCustomProviderRequest>,
    ) -> ServiceResult<DeleteCustomProviderResponse> {
        self.domain
            .delete_custom(parse_id(request.id)?)
            .await
            .map_err(map_domain)?;
        Response::ok(DeleteCustomProviderResponse::default())
    }

    async fn fetch_models(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, FetchModelsRequest>,
    ) -> ServiceResult<FetchModelsResponse> {
        let models = self
            .domain
            .fetch_models(parse_id(request.id)?)
            .await
            .map_err(map_domain)?;
        Response::ok(FetchModelsResponse {
            models,
            ..Default::default()
        })
    }

    async fn check_provider(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, CheckProviderRequest>,
    ) -> ServiceResult<CheckProviderResponse> {
        let id = parse_id(request.id)?;
        let error = match self.domain.check(id, request.model).await {
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
        _ctx: RequestContext,
        _request: ServiceRequest<'_, ListWebProvidersRequest>,
    ) -> ServiceResult<ListWebProvidersResponse> {
        let providers = self.domain.list_web().await.map_err(map_domain)?;
        Response::ok(ListWebProvidersResponse {
            providers: providers.into_iter().map(web_to_proto).collect(),
            ..Default::default()
        })
    }

    async fn update_web_provider(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, UpdateWebProviderRequest>,
    ) -> ServiceResult<UpdateWebProviderResponse> {
        let input = UpdateWebInput {
            api_key: request.api_key.map(ToString::to_string),
            enabled: request.enabled,
        };
        let provider = self
            .domain
            .update_web(parse_id(request.id)?, input)
            .await
            .map_err(map_domain)?;
        Response::ok(UpdateWebProviderResponse {
            provider: web_to_proto(provider).into(),
            ..Default::default()
        })
    }

    async fn set_web_provider_order(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, SetWebProviderOrderRequest>,
    ) -> ServiceResult<SetWebProviderOrderResponse> {
        let function = web_function_from_proto(request.function.as_known())?;
        let ids: Vec<_> = request
            .ids
            .iter()
            .map(|id| parse_id(id))
            .collect::<Result<_, _>>()?;
        let providers = self
            .domain
            .set_web_order(function, &ids)
            .await
            .map_err(map_domain)?;
        Response::ok(SetWebProviderOrderResponse {
            providers: providers.into_iter().map(web_to_proto).collect(),
            ..Default::default()
        })
    }
}
