use lemma_core::{ContentBlock, Message};

/// Vendor family selecting the wire protocol of a chat request.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderKind {
    /// OpenAI chat-completions and compatible APIs.
    OpenAiCompatible,
    /// Anthropic Messages API.
    Anthropic,
    /// Google Gemini generateContent API.
    Gemini,
}

/// One streaming chat call against a provider.
#[derive(Debug, Clone)]
pub struct ChatRequest {
    /// Vendor family selecting the adapter.
    pub kind: ProviderKind,
    /// Provider base URL, e.g. `https://api.openai.com/v1`.
    pub base_url: String,
    /// API path override; empty selects the adapter default.
    pub api_path: String,
    /// Plaintext key, opened from its sealed form just before the call.
    pub api_key: String,
    /// Model id as the vendor expects it.
    pub model: String,
    /// Conversation history in canonical form.
    pub messages: Vec<Message>,
}

/// Extracts the `(role, text)` pair of a message for text-only wire
/// formats. Thinking, tool-call, image, and tool-result content has no
/// text-only representation and is skipped until the tool-calling
/// increment extends the adapters.
pub(crate) fn role_text(message: &Message) -> Option<(&'static str, String)> {
    let (role, content) = match message {
        Message::User { content } => ("user", content),
        Message::Assistant { content, .. } => ("assistant", content),
        Message::ToolResult { .. } => return None,
    };
    let text: String = content
        .iter()
        .filter_map(|b| match b {
            ContentBlock::Text(t) => Some(t.text.as_str()),
            _ => None,
        })
        .collect();
    Some((role, text))
}
