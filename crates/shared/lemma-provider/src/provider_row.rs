use sqlx::types::Json;
use uuid::Uuid;

use lemma_model::ApiFormat;

use crate::provider_error::ProviderError;
use crate::provider_model::ProviderModel;

#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum ProviderSource {
    Custom,
    Predefined,
}

impl ProviderSource {
    fn parse(raw: &str) -> Result<Self, ProviderError> {
        match raw {
            "custom" => Ok(Self::Custom),
            "predefined" => Ok(Self::Predefined),
            other => Err(ProviderError::Store(format!(
                "unknown provider source: {other}"
            ))),
        }
    }
}

pub(crate) struct ProviderRow {
    pub(crate) id: Uuid,
    pub(crate) api_format: ApiFormat,
    pub(crate) source: ProviderSource,
    pub(crate) identifier: String,
    pub(crate) name: String,
    pub(crate) base_url: String,
    pub(crate) api_key: String,
    pub(crate) api_path: String,
    pub(crate) models_path: String,
    pub(crate) models: Vec<ProviderModel>,
    pub(crate) enabled: bool,
}

pub(crate) type ProviderTuple = (
    Uuid,
    String,
    String,
    String,
    String,
    String,
    String,
    String,
    String,
    Json<Vec<ProviderModel>>,
    bool,
);

pub(crate) fn from_tuple(
    (
        id,
        api_format,
        source,
        identifier,
        name,
        base_url,
        api_key,
        api_path,
        models_path,
        models,
        enabled,
    ): ProviderTuple,
) -> Result<ProviderRow, ProviderError> {
    let Some(api_format) = ApiFormat::parse(&api_format) else {
        return Err(ProviderError::Store(format!(
            "unknown api format: {api_format}"
        )));
    };
    Ok(ProviderRow {
        id,
        api_format,
        source: ProviderSource::parse(&source)?,
        identifier,
        name,
        base_url,
        api_key,
        api_path,
        models_path,
        models: models.0,
        enabled,
    })
}

#[cfg(test)]
mod tests {
    use super::ProviderSource;

    #[test]
    fn provider_wire_encodings_round_trip() {
        assert!(
            ProviderSource::parse("custom").is_ok() && ProviderSource::parse("predefined").is_ok(),
            "known sources"
        );
        assert!(
            ProviderSource::parse("bogus").is_err(),
            "unknown source rejected"
        );
    }
}
