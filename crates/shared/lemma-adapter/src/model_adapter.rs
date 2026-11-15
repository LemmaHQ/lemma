use lemma_model::{Adapter, BoxEventStream, ModelError, ModelRequest};

use crate::anthropic_messages::AnthropicMessages;
use crate::gemini_generate::GeminiGenerate;
use crate::http_transport::HttpTransport;
use crate::open_ai_compatible::OpenAiCompatible;

/// The adapter [`HttpConnector`](crate::HttpConnector) binds an endpoint to.
#[derive(Debug)]
pub struct ModelAdapter<T>(Inner<T>);

#[derive(Debug)]
enum Inner<T> {
    OpenAi(OpenAiCompatible<T>),
    Anthropic(AnthropicMessages<T>),
    Gemini(GeminiGenerate<T>),
}

impl<T: HttpTransport> ModelAdapter<T> {
    pub(crate) fn open_ai(adapter: OpenAiCompatible<T>) -> Self {
        Self(Inner::OpenAi(adapter))
    }

    pub(crate) fn anthropic(adapter: AnthropicMessages<T>) -> Self {
        Self(Inner::Anthropic(adapter))
    }

    pub(crate) fn gemini(adapter: GeminiGenerate<T>) -> Self {
        Self(Inner::Gemini(adapter))
    }
}

impl<T: HttpTransport> Adapter for ModelAdapter<T> {
    async fn stream(&self, req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        match &self.0 {
            Inner::OpenAi(adapter) => adapter.stream(req).await,
            Inner::Anthropic(adapter) => adapter.stream(req).await,
            Inner::Gemini(adapter) => adapter.stream(req).await,
        }
    }
}
