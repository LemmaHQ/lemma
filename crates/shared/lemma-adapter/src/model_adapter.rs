use lemma_model::{Adapter, BoxEventStream, ModelError, ModelRequest};

use crate::anthropic_messages::AnthropicMessages;
use crate::gemini_generate::GeminiGenerate;
use crate::http_transport::HttpTransport;
use crate::open_ai_compatible::OpenAiCompatible;

/// The adapter [`HttpConnector`](crate::HttpConnector) binds an endpoint
/// to, one variant per provider kind.
#[derive(Debug)]
pub enum ModelAdapter<T> {
    /// An OpenAI-compatible endpoint.
    OpenAi(OpenAiCompatible<T>),
    /// An Anthropic endpoint.
    Anthropic(AnthropicMessages<T>),
    /// A Gemini endpoint.
    Gemini(GeminiGenerate<T>),
}

impl<T: HttpTransport> Adapter for ModelAdapter<T> {
    async fn stream(&self, req: ModelRequest) -> Result<BoxEventStream, ModelError> {
        match self {
            Self::OpenAi(adapter) => adapter.stream(req).await,
            Self::Anthropic(adapter) => adapter.stream(req).await,
            Self::Gemini(adapter) => adapter.stream(req).await,
        }
    }
}
