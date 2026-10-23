//! Connect RPC shell over the provider domain: JWT authentication,
//! proto mapping, and wire error mapping. All behavior lives in
//! `lemma-provider`.

use std::fmt::{self, Debug};
use std::sync::Arc;

use buffa_types::google::protobuf::Timestamp;
use connectrpc::{ConnectError, RequestContext, Response, ServiceRequest, ServiceResult};
use lemma_model::{Connector, ProviderKind};
use lemma_proto::lemma::v1;
use lemma_proto::lemma::v1::{
    CreateProviderRequest, CreateProviderResponse, DeleteProviderRequest, DeleteProviderResponse,
    ErrorReason, FetchModelsRequest, FetchModelsResponse, ListProvidersRequest,
    ListProvidersResponse, Provider, UpdateProviderRequest, UpdateProviderResponse,
};
use lemma_provider::{
    CreateInput, ProviderError, ProviderService, ProviderStore, ProviderView, UpdateInput,
};
use uuid::Uuid;

/// Maps a proto kind to the domain kind. Returns `None` for unspecified
/// or unknown values.
#[must_use]
pub fn kind_from_proto(kind: v1::ProviderKind) -> Option<ProviderKind> {
    match kind {
        v1::ProviderKind::Openai => Some(ProviderKind::OpenAiCompatible),
        v1::ProviderKind::Anthropic => Some(ProviderKind::Anthropic),
        v1::ProviderKind::Gemini => Some(ProviderKind::Gemini),
        _ => None,
    }
}

/// Maps a domain kind to its proto enum.
#[must_use]
pub fn kind_to_proto(kind: ProviderKind) -> v1::ProviderKind {
    match kind {
        ProviderKind::OpenAiCompatible => v1::ProviderKind::Openai,
        ProviderKind::Anthropic => v1::ProviderKind::Anthropic,
        ProviderKind::Gemini => v1::ProviderKind::Gemini,
    }
}

/// Connect handler implementing the `ProviderService` RPCs.
///
/// `jwt_secret` authenticates requests; `domain` seals API keys at rest
/// and fetches model lists.
pub struct ProviderRpc<P, C> {
    domain: Arc<ProviderService<P, C>>,
    jwt_secret: String,
}

impl<P: Debug, C: Debug> Debug for ProviderRpc<P, C> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ProviderRpc")
            .field("domain", &self.domain)
            .finish_non_exhaustive()
    }
}

impl<P: ProviderStore, C: Connector> ProviderRpc<P, C> {
    /// Creates the handler over the provider domain service, which the
    /// agent shares.
    pub fn new(domain: Arc<ProviderService<P, C>>, jwt_secret: String) -> Self {
        Self { domain, jwt_secret }
    }
}

fn to_proto(v: ProviderView) -> Provider {
    Provider {
        id: v.id.to_string(),
        kind: kind_to_proto(v.kind).into(),
        identifier: v.identifier,
        name: v.name,
        base_url: v.base_url,
        api_key: v.api_key,
        models: v.models,
        enabled: v.enabled,
        api_path: v.api_path,
        models_path: v.models_path,
        created_at: Timestamp::from(v.created_at).into(),
        updated_at: Timestamp::from(v.updated_at).into(),
        ..Default::default()
    }
}

fn parse_id(id: &str) -> Result<Uuid, ConnectError> {
    Uuid::parse_str(id).map_err(|_| lemma_proto::app_error(ErrorReason::IdInvalid))
}

fn map_domain(e: ProviderError) -> ConnectError {
    match e {
        ProviderError::FieldsRequired => {
            lemma_proto::app_error(ErrorReason::ProviderFieldsRequired)
        }
        ProviderError::IdentifierInvalid => {
            lemma_proto::app_error(ErrorReason::ProviderIdentifierInvalid)
        }
        ProviderError::IdentifierTaken => {
            lemma_proto::app_error(ErrorReason::ProviderIdentifierTaken)
        }
        ProviderError::NotFound => lemma_proto::app_error(ErrorReason::ProviderNotFound),
        ProviderError::Crypto(m) => ConnectError::internal(format!("crypto: {m}")),
        ProviderError::Store(m) => ConnectError::internal(format!("db: {m}")),
        ProviderError::Fetch(m) => ConnectError::internal(format!("fetch models: {m}")),
    }
}

#[allow(refining_impl_trait)]
impl<P: ProviderStore, C: Connector> v1::ProviderService for ProviderRpc<P, C> {
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
        let kind = request
            .kind
            .as_known()
            .and_then(kind_from_proto)
            .ok_or_else(|| lemma_proto::app_error(ErrorReason::ProviderKindInvalid))?;
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
            let kind = request
                .kind
                .as_known()
                .and_then(kind_from_proto)
                .ok_or_else(|| lemma_proto::app_error(ErrorReason::ProviderKindInvalid))?;
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
}
