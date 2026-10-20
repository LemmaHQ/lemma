use lemma_core::{Message, ToolSpec};

/// One streaming model call: what a step sends to its adapter.
#[derive(Debug, Clone)]
pub struct ModelRequest {
    /// Model id as the vendor expects it.
    pub model: String,
    /// Conversation history in canonical form.
    pub messages: Vec<Message>,
    /// Tool definitions advertised to the model; empty disables tool use.
    pub tools: Vec<ToolSpec>,
    /// Reasoning effort knob (`low`/`medium`/`high` or a numeric budget),
    /// forwarded to the vendor's thinking control when set and non-empty.
    pub thinking_effort: Option<String>,
}
