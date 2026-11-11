use lemma_core::{Message, ToolSpec};

/// One streaming model call: what a step sends to its adapter.
#[derive(Debug, Clone)]
pub struct ModelRequest {
    /// Model id as the vendor expects it.
    pub model: String,
    /// Instructions sent ahead of the history; `None` sends none.
    pub system_prompt: Option<String>,
    /// Session history in canonical form.
    pub messages: Vec<Message>,
    /// Tool definitions advertised to the model; empty disables tool use.
    pub tools: Vec<ToolSpec>,
}
