use lemma_model::ApiFormat;

pub(crate) struct PredefinedProvider {
    pub(crate) identifier: &'static str,
    pub(crate) name: &'static str,
    pub(crate) formats: &'static [PredefinedFormat],
    pub(crate) default_api_format: ApiFormat,
    pub(crate) models: &'static [PredefinedModel],
}

pub(crate) struct PredefinedFormat {
    pub(crate) api_format: ApiFormat,
    pub(crate) base_url: &'static str,
}

pub(crate) struct PredefinedModel {
    pub(crate) id: &'static str,
    pub(crate) tool_calling: bool,
}

const DEEPSEEK: PredefinedProvider = PredefinedProvider {
    identifier: "deepseek",
    name: "DeepSeek",
    formats: &[
        PredefinedFormat {
            api_format: ApiFormat::Anthropic,
            base_url: "https://api.deepseek.com/anthropic",
        },
        PredefinedFormat {
            api_format: ApiFormat::OpenAiCompatible,
            base_url: "https://api.deepseek.com",
        },
    ],
    default_api_format: ApiFormat::Anthropic,
    models: &[
        PredefinedModel {
            id: "deepseek-flash",
            tool_calling: true,
        },
        PredefinedModel {
            id: "deepseek-v4-pro",
            tool_calling: true,
        },
    ],
};

const CATALOG: &[PredefinedProvider] = &[DEEPSEEK];

pub(crate) fn catalog() -> &'static [PredefinedProvider] {
    CATALOG
}

pub(crate) fn find(identifier: &str) -> Option<&'static PredefinedProvider> {
    CATALOG
        .iter()
        .find(|preset| preset.identifier == identifier)
}

impl PredefinedProvider {
    pub(crate) fn serves(&self, api_format: ApiFormat) -> bool {
        self.formats
            .iter()
            .any(|format| format.api_format == api_format)
    }

    pub(crate) fn base_url(&self, api_format: ApiFormat) -> Option<&'static str> {
        self.formats
            .iter()
            .find(|format| format.api_format == api_format)
            .map(|format| format.base_url)
    }

    pub(crate) fn tool_calling(&self, model: &str) -> bool {
        self.models
            .iter()
            .find(|entry| entry.id == model)
            .is_none_or(|entry| entry.tool_calling)
    }
}
