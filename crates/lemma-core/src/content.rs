use serde::{Deserialize, Serialize};

/// One block of message content, independent of any vendor format.
///
/// Thinking blocks sit at the same level as text: every reasoning model
/// (DeepSeek, Claude extended thinking, OpenAI o-series) normalizes into
/// this single representation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    /// Plain generated or user-provided text.
    Text(TextContent),
    /// Model reasoning produced alongside the visible answer.
    Thinking(ThinkingContent),
    /// A request to execute a named tool.
    ToolCall(ToolCall),
    /// An inline image.
    Image(ImageContent),
}

/// Plain text block.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TextContent {
    /// The text itself.
    pub text: String,
}

/// Model reasoning block.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ThinkingContent {
    /// The reasoning text.
    pub thinking: String,
    /// Opaque vendor signature required to replay the block verbatim
    /// (e.g. Anthropic signed thinking); `None` for unsigned reasoning.
    pub signature: Option<String>,
}

/// A tool invocation requested by the model.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolCall {
    /// Provider-assigned call id; results reference it.
    pub id: String,
    /// Tool name as advertised to the model.
    pub name: String,
    /// Call arguments, already parsed from the wire form.
    pub arguments: serde_json::Value,
}

/// An inline image block.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ImageContent {
    /// MIME type, e.g. `image/png`.
    pub mime_type: String,
    /// Reference to the content-addressed blob store; raw bytes are never
    /// embedded in the trace.
    pub blob_ref: String,
}
