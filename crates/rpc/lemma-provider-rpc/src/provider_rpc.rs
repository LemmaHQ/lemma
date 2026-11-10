use std::fmt::{self, Debug};
use std::sync::Arc;

use connectrpc::{RequestContext, Response, ServiceRequest, ServiceResult};
use lemma_model::{Connector, Endpoint};
use lemma_proto::lemma::v1;
use lemma_proto::lemma::v1::{
    CheckProviderRequest, CheckProviderResponse, CreateProviderRequest, CreateProviderResponse,
    DeleteProviderRequest, DeleteProviderResponse, ErrorReason, FetchModelsRequest,
    FetchModelsResponse, ListProvidersRequest, ListProvidersResponse, UpdateProviderRequest,
    UpdateProviderResponse,
};
use lemma_provider::{CreateInput, ProviderError, ProviderService, UpdateInput};

use crate::provider_mapping::{adhoc_kind, map_domain, parse_id, to_proto};

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

    async fn create_provider(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, CreateProviderRequest>,
    ) -> ServiceResult<CreateProviderResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let kind = adhoc_kind(request.kind.as_known())?;
        let input = CreateInput {
            kind,
            identifier: request.identifier.to_string(),
            name: request.name.to_string(),
            base_url: request.base_url.to_string(),
            api_key: request.api_key.to_string(),
            api_path: request.api_path.to_string(),
            models_path: request.models_path.to_string(),
            models: request.models.iter().map(ToString::to_string).collect(),
        };
        let provider = self
            .domain
            .create(user_id, input)
            .await
            .map_err(map_domain)?;
        Response::ok(CreateProviderResponse {
            provider: to_proto(provider).into(),
            ..Default::default()
        })
    }

    async fn update_provider(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, UpdateProviderRequest>,
    ) -> ServiceResult<UpdateProviderResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let id = parse_id(request.id)?;
        let input = UpdateInput {
            name: request.name.map(ToString::to_string),
            base_url: request.base_url.map(ToString::to_string),
            api_key: request.api_key.map(ToString::to_string),
            api_path: request.api_path.map(ToString::to_string),
            models_path: request.models_path.map(ToString::to_string),
            enabled: request.enabled,
            models: request
                .models
                .as_option()
                .map(|m| m.models.iter().map(ToString::to_string).collect()),
        };
        let provider = self
            .domain
            .update(user_id, id, input)
            .await
            .map_err(map_domain)?;
        Response::ok(UpdateProviderResponse {
            provider: to_proto(provider).into(),
            ..Default::default()
        })
    }

    async fn delete_provider(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, DeleteProviderRequest>,
    ) -> ServiceResult<DeleteProviderResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let id = parse_id(request.id)?;
        self.domain.delete(user_id, id).await.map_err(map_domain)?;
        Response::ok(DeleteProviderResponse::default())
    }

    async fn fetch_models(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, FetchModelsRequest>,
    ) -> ServiceResult<FetchModelsResponse> {
        let user_id = lemma_auth_rpc::require_user(&self.jwt_secret, &ctx)?;
        let models = if request.id.is_empty() {
            let kind = adhoc_kind(request.kind.as_known())?;
            self.domain
                .fetch_models_adhoc(kind, request.base_url, request.api_key, request.models_path)
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
            let kind = adhoc_kind(request.kind.as_known())?;
            let endpoint = Endpoint {
                kind,
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
}
