//! Connect RPC shell over the provider domain: JWT authentication,
//! proto mapping, and wire error mapping. All behavior lives in
//! `lemma-provider`.

use std::sync::Arc;

use buffa_types::google::protobuf::Timestamp;
use connectrpc::{ConnectError, RequestContext, Response, ServiceRequest, ServiceResult};
use lemma_auth_rpc::require_user;
use lemma_proto::app_error;
use lemma_proto::lemma::v1::{
    CreateProviderResponse, DeleteProviderResponse, ErrorReason, FetchModelsResponse,
    ListProvidersResponse, Provider, UpdateProviderResponse,
};
use lemma_provider::{
    CreateInput, ProviderError, ProviderKind, ProviderService, ProviderStore, ProviderView,
    UpdateInput,
};
use uuid::Uuid;

/// Maps a proto kind to the domain kind. Returns `None` for unspecified
/// or unknown values.
pub fn kind_from_proto(kind: lemma_proto::lemma::v1::ProviderKind) -> Option<ProviderKind> {
    match kind {
        lemma_proto::lemma::v1::ProviderKind::Openai => Some(ProviderKind::OpenAiCompatible),
        lemma_proto::lemma::v1::ProviderKind::Anthropic => Some(ProviderKind::Anthropic),
        lemma_proto::lemma::v1::ProviderKind::Gemini => Some(ProviderKind::Gemini),
        _ => None,
    }
}

/// Maps a domain kind to its proto enum.
pub fn kind_to_proto(kind: ProviderKind) -> lemma_proto::lemma::v1::ProviderKind {
    match kind {
        ProviderKind::OpenAiCompatible => lemma_proto::lemma::v1::ProviderKind::Openai,
        ProviderKind::Anthropic => lemma_proto::lemma::v1::ProviderKind::Anthropic,
        ProviderKind::Gemini => lemma_proto::lemma::v1::ProviderKind::Gemini,
    }
}

/// Maps a proto kind to its stored string. Returns `None` for
/// unspecified or unknown values.
pub fn kind_to_str(kind: lemma_proto::lemma::v1::ProviderKind) -> Option<&'static str> {
    kind_from_proto(kind).map(|k| k.as_str())
}

/// Connect handler implementing the ProviderService RPCs.
///
/// `jwt_secret` authenticates requests; `secret_key` is handed to the
/// domain to seal provider API keys at rest.
pub struct ProviderRpc {
    domain: ProviderService,
    jwt_secret: Arc<str>,
}

impl ProviderRpc {
    /// Creates the handler over a provider store backend.
    pub fn new(
        store: Arc<dyn ProviderStore>,
        jwt_secret: impl Into<Arc<str>>,
        secret_key: impl Into<Arc<str>>,
    ) -> Self {
        Self {
            domain: ProviderService::new(store, Some(secret_key.into())),
            jwt_secret: jwt_secret.into(),
        }
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
    Uuid::parse_str(id).map_err(|_| app_error(ErrorReason::IdInvalid))
}

fn map_domain(e: ProviderError) -> ConnectError {
    match e {
        ProviderError::FieldsRequired => app_error(ErrorReason::ProviderFieldsRequired),
        ProviderError::IdentifierInvalid => app_error(ErrorReason::ProviderIdentifierInvalid),
        ProviderError::IdentifierTaken => app_error(ErrorReason::ProviderIdentifierTaken),
        ProviderError::NotFound => app_error(ErrorReason::ProviderNotFound),
        ProviderError::Crypto(m) => ConnectError::internal(format!("crypto: {m}")),
        ProviderError::Store(m) => ConnectError::internal(format!("db: {m}")),
        ProviderError::Fetch(m) => ConnectError::internal(format!("fetch models: {m}")),
    }
}

#[allow(refining_impl_trait)]
impl lemma_proto::lemma::v1::ProviderService for ProviderRpc {
    async fn list_providers(
        &self,
        ctx: RequestContext,
        _request: ServiceRequest<'_, lemma_proto::lemma::v1::ListProvidersRequest>,
    ) -> ServiceResult<ListProvidersResponse> {
        let user_id = require_user(&self.jwt_secret, &ctx)?;
        let providers = self.domain.list(user_id).await.map_err(map_domain)?;
        Response::ok(ListProvidersResponse {
            providers: providers.into_iter().map(to_proto).collect(),
            ..Default::default()
        })
    }

    async fn create_provider(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, lemma_proto::lemma::v1::CreateProviderRequest>,
    ) -> ServiceResult<CreateProviderResponse> {
        let user_id = require_user(&self.jwt_secret, &ctx)?;
        let kind = request
            .kind
            .as_known()
            .and_then(kind_from_proto)
            .ok_or_else(|| app_error(ErrorReason::ProviderKindInvalid))?;
        let input = CreateInput {
            kind,
            identifier: request.identifier.to_string(),
            name: request.name.to_string(),
            base_url: request.base_url.to_string(),
            api_key: request.api_key.to_string(),
            api_path: request.api_path.to_string(),
            models_path: request.models_path.to_string(),
            models: request.models.iter().map(|s| s.to_string()).collect(),
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
        request: ServiceRequest<'_, lemma_proto::lemma::v1::UpdateProviderRequest>,
    ) -> ServiceResult<UpdateProviderResponse> {
        let user_id = require_user(&self.jwt_secret, &ctx)?;
        let id = parse_id(request.id)?;
        let input = UpdateInput {
            name: request.name.map(|s| s.to_string()),
            base_url: request.base_url.map(|s| s.to_string()),
            api_key: request.api_key.map(|s| s.to_string()),
            api_path: request.api_path.map(|s| s.to_string()),
            models_path: request.models_path.map(|s| s.to_string()),
            enabled: request.enabled,
            models: request
                .models
                .as_option()
                .map(|m| m.models.iter().map(|s| s.to_string()).collect()),
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
        request: ServiceRequest<'_, lemma_proto::lemma::v1::DeleteProviderRequest>,
    ) -> ServiceResult<DeleteProviderResponse> {
        let user_id = require_user(&self.jwt_secret, &ctx)?;
        let id = parse_id(request.id)?;
        self.domain.delete(user_id, id).await.map_err(map_domain)?;
        Response::ok(DeleteProviderResponse::default())
    }

    async fn fetch_models(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, lemma_proto::lemma::v1::FetchModelsRequest>,
    ) -> ServiceResult<FetchModelsResponse> {
        let user_id = require_user(&self.jwt_secret, &ctx)?;
        let models = if request.id.is_empty() {
            let kind = request
                .kind
                .as_known()
                .and_then(kind_from_proto)
                .ok_or_else(|| app_error(ErrorReason::ProviderKindInvalid))?;
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
