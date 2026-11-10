use connectrpc::ConnectError;
use lemma_model::ProviderKind;
use lemma_proto::lemma::v1;
use lemma_proto::lemma::v1::{ErrorReason, Provider};
use lemma_provider::{ProviderError, ProviderView};
use uuid::Uuid;

/// Maps a proto kind to the domain kind. Returns `None` for unspecified
/// or unknown values.
#[must_use]
pub(crate) fn kind_from_proto(kind: v1::ProviderKind) -> Option<ProviderKind> {
    match kind {
        v1::ProviderKind::Openai => Some(ProviderKind::OpenAiCompatible),
        v1::ProviderKind::Anthropic => Some(ProviderKind::Anthropic),
        v1::ProviderKind::Gemini => Some(ProviderKind::Gemini),
        _ => None,
    }
}

/// Maps a domain kind to its proto enum.
#[must_use]
pub(crate) fn kind_to_proto(kind: ProviderKind) -> v1::ProviderKind {
    match kind {
        ProviderKind::OpenAiCompatible => v1::ProviderKind::Openai,
        ProviderKind::Anthropic => v1::ProviderKind::Anthropic,
        ProviderKind::Gemini => v1::ProviderKind::Gemini,
    }
}

pub(crate) fn to_proto(v: ProviderView) -> Provider {
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
        ..Default::default()
    }
}

pub(crate) fn parse_id(id: &str) -> Result<Uuid, ConnectError> {
    Uuid::parse_str(id).map_err(|_| lemma_proto::app_error(ErrorReason::IdInvalid))
}

pub(crate) fn map_domain(e: ProviderError) -> ConnectError {
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
        ProviderError::Store(m) => ConnectError::internal(format!("db: {m}")),
        e @ (ProviderError::Crypto(_) | ProviderError::Fetch(_) | ProviderError::Check(_)) => {
            ConnectError::internal(e.to_string())
        }
    }
}

pub(crate) fn adhoc_kind(kind: Option<v1::ProviderKind>) -> Result<ProviderKind, ConnectError> {
    kind.and_then(kind_from_proto)
        .ok_or_else(|| lemma_proto::app_error(ErrorReason::ProviderKindInvalid))
}
