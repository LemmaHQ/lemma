use crate::anthropic::AnthropicMessages;
use crate::gemini::GeminiGenerate;
use crate::openai::OpenAiCompatible;
use crate::provider::{BoxChatFuture, Provider};
use crate::request::{ChatRequest, ProviderKind};

/// Routes chat requests to the adapter for the provider kind.
pub struct DispatchProvider {
    openai: OpenAiCompatible,
    anthropic: AnthropicMessages,
    gemini: GeminiGenerate,
}

impl DispatchProvider {
    /// Creates a dispatcher with one adapter per known provider kind.
    pub fn new() -> Self {
        Self {
            openai: OpenAiCompatible::new(),
            anthropic: AnthropicMessages::new(),
            gemini: GeminiGenerate::new(),
        }
    }

    fn select(&self, kind: ProviderKind) -> &dyn Provider {
        match kind {
            ProviderKind::Anthropic => &self.anthropic,
            ProviderKind::Gemini => &self.gemini,
            ProviderKind::OpenAiCompatible => &self.openai,
        }
    }
}

impl Default for DispatchProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl Provider for DispatchProvider {
    fn stream(&self, req: ChatRequest) -> BoxChatFuture {
        self.select(req.kind).stream(req)
    }
}
