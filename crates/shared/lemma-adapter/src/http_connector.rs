use lemma_model::{Connector, Endpoint, ModelError, ProviderKind};

use crate::anthropic_messages::AnthropicMessages;
use crate::gemini_generate::GeminiGenerate;
use crate::http_transport::HttpTransport;
use crate::model_adapter::ModelAdapter;
use crate::models;
use crate::open_ai_compatible::OpenAiCompatible;

/// Binds endpoints to the adapter for their provider kind, all sending
/// HTTP through one transport.
#[derive(Debug, Clone)]
pub struct HttpConnector<T> {
    transport: T,
}

impl<T: HttpTransport> HttpConnector<T> {
    /// Creates the connector over `transport`.
    pub fn new(transport: T) -> Self {
        Self { transport }
    }
}

impl<T: HttpTransport> Connector for HttpConnector<T> {
    type Adapter = ModelAdapter<T>;

    fn connect(&self, endpoint: Endpoint) -> ModelAdapter<T> {
        let transport = self.transport.clone();
        match endpoint.kind {
            ProviderKind::OpenAiCompatible => {
                ModelAdapter::OpenAi(OpenAiCompatible::new(transport, endpoint))
            }
            ProviderKind::Anthropic => {
                ModelAdapter::Anthropic(AnthropicMessages::new(transport, endpoint))
            }
            ProviderKind::Gemini => ModelAdapter::Gemini(GeminiGenerate::new(transport, endpoint)),
        }
    }

    async fn list_models(&self, endpoint: Endpoint) -> Result<Vec<String>, ModelError> {
        models::list_models(&self.transport, endpoint).await
    }
}
