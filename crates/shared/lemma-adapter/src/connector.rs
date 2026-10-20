use std::sync::Arc;

use lemma_model::{Adapter, BoxModelsFuture, Connector, Endpoint, ProviderKind};

use crate::anthropic::AnthropicMessages;
use crate::gemini::GeminiGenerate;
use crate::models::list_models;
use crate::openai::OpenAiCompatible;
use crate::transport::HttpTransport;

/// Binds endpoints to the adapter for their provider kind, all sending
/// HTTP through one transport.
pub struct HttpConnector {
    transport: Arc<dyn HttpTransport>,
}

impl HttpConnector {
    /// Creates the connector over `transport`.
    pub fn new(transport: Arc<dyn HttpTransport>) -> Self {
        Self { transport }
    }
}

impl Connector for HttpConnector {
    fn connect(&self, endpoint: Endpoint) -> Arc<dyn Adapter> {
        let transport = Arc::clone(&self.transport);
        match endpoint.kind {
            ProviderKind::OpenAiCompatible => Arc::new(OpenAiCompatible::new(transport, endpoint)),
            ProviderKind::Anthropic => Arc::new(AnthropicMessages::new(transport, endpoint)),
            ProviderKind::Gemini => Arc::new(GeminiGenerate::new(transport, endpoint)),
        }
    }

    fn list_models(&self, endpoint: Endpoint) -> BoxModelsFuture {
        let transport = Arc::clone(&self.transport);
        Box::pin(async move { list_models(transport.as_ref(), endpoint).await })
    }
}
