use connectrpc::ConnectError;
use lemma_model::ApiFormat;
use lemma_proto::lemma::v1;
use lemma_proto::lemma::v1::{ErrorReason, Provider};
use lemma_provider::{
    ProviderError, ProviderModel, ProviderView, WebFunction, WebProviderKind, WebProviderView,
};

pub(crate) fn format_from_proto(format: v1::ApiFormat) -> Option<ApiFormat> {
    match format {
        v1::ApiFormat::Openai => Some(ApiFormat::OpenAiCompatible),
        v1::ApiFormat::Anthropic => Some(ApiFormat::Anthropic),
        v1::ApiFormat::Gemini => Some(ApiFormat::Gemini),
        _ => None,
    }
}

pub(crate) fn format_to_proto(format: ApiFormat) -> v1::ApiFormat {
    match format {
        ApiFormat::OpenAiCompatible => v1::ApiFormat::Openai,
        ApiFormat::Anthropic => v1::ApiFormat::Anthropic,
        ApiFormat::Gemini => v1::ApiFormat::Gemini,
    }
}

pub(crate) fn models_from_proto<'model: 'request, 'request>(
    models: impl IntoIterator<Item = &'request v1::ModelView<'model>>,
) -> Vec<ProviderModel> {
    models
        .into_iter()
        .map(|model| ProviderModel {
            id: model.id.to_string(),
            tool_calling: model.tool_calling,
        })
        .collect()
}

fn models_to_proto(models: Vec<ProviderModel>) -> Vec<v1::Model> {
    models
        .into_iter()
        .map(|model| v1::Model {
            id: model.id,
            tool_calling: model.tool_calling,
            ..Default::default()
        })
        .collect()
}

pub(crate) fn to_proto(view: ProviderView) -> Provider {
    match view {
        ProviderView::Custom(custom) => Provider {
            id: custom.id.to_string(),
            enabled: custom.enabled,
            has_key: custom.has_key,
            source: Some(v1::provider::Source::Custom(Box::new(v1::CustomProvider {
                identifier: custom.identifier,
                name: custom.name,
                api_format: format_to_proto(custom.api_format).into(),
                base_url: custom.base_url,
                api_path: custom.api_path,
                models_path: custom.models_path,
                models: models_to_proto(custom.models),
                ..Default::default()
            }))),
            ..Default::default()
        },
        ProviderView::Predefined(predefined) => Provider {
            id: predefined.id.to_string(),
            enabled: predefined.enabled,
            has_key: predefined.has_key,
            source: Some(v1::provider::Source::Predefined(Box::new(
                v1::PredefinedProvider {
                    identifier: predefined.identifier,
                    name: predefined.name,
                    api_formats: predefined
                        .api_formats
                        .into_iter()
                        .map(|format| format_to_proto(format).into())
                        .collect(),
                    default_api_format: format_to_proto(predefined.default_api_format).into(),
                    models: models_to_proto(predefined.models),
                    ..Default::default()
                },
            ))),
            ..Default::default()
        },
    }
}

pub(crate) fn web_to_proto(view: WebProviderView) -> v1::WebProvider {
    let kind = match view.kind {
        WebProviderKind::Native => v1::web_provider::Kind::Native,
        WebProviderKind::Exa => v1::web_provider::Kind::Exa,
        WebProviderKind::DeepSeek => v1::web_provider::Kind::Deepseek,
    };
    v1::WebProvider {
        id: view.id.to_string(),
        kind: kind.into(),
        name: view.name,
        enabled: view.enabled,
        has_key: view.has_key,
        search_rank: view.search_rank,
        fetch_rank: view.fetch_rank,
        ..Default::default()
    }
}

pub(crate) fn web_function_from_proto(
    function: Option<v1::set_web_provider_order_request::Function>,
) -> Result<WebFunction, ConnectError> {
    match function {
        Some(v1::set_web_provider_order_request::Function::Search) => Ok(WebFunction::Search),
        Some(v1::set_web_provider_order_request::Function::Fetch) => Ok(WebFunction::Fetch),
        _ => Err(lemma_proto::app_error(ErrorReason::ProviderFieldsRequired)),
    }
}

pub(crate) fn map_domain(e: ProviderError) -> ConnectError {
    match e {
        ProviderError::FieldsRequired => {
            lemma_proto::app_error(ErrorReason::ProviderFieldsRequired)
        }
        ProviderError::ApiFormatInvalid => lemma_proto::app_error(ErrorReason::ApiFormatInvalid),
        ProviderError::KeyRequired => lemma_proto::app_error(ErrorReason::ProviderKeyRequired),
        ProviderError::ModelRequired => lemma_proto::app_error(ErrorReason::ModelRequired),
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

pub(crate) fn require_format(format: Option<v1::ApiFormat>) -> Result<ApiFormat, ConnectError> {
    format
        .and_then(format_from_proto)
        .ok_or_else(|| lemma_proto::app_error(ErrorReason::ApiFormatInvalid))
}
