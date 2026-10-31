use chrono::{DateTime, Utc};
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
    /// Server instant of the first reasoning delta.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub started_at: Option<DateTime<Utc>>,
    /// Server instant of the first non-thinking event after reasoning began.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<DateTime<Utc>>,
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
    /// Server instant at which tool execution started.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub started_at: Option<DateTime<Utc>>,
    /// Server instant at which the tool result arrived.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<DateTime<Utc>>,
}

impl ContentBlock {
    /// The visible text of a text block, returning `None` for structured
    /// content kinds.
    #[must_use]
    pub fn plain_text(&self) -> Option<&str> {
        match self {
            Self::Text(t) => Some(&t.text),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_stored_before_timing_load_without_timestamps() {
        let thinking: ThinkingContent =
            serde_json::from_str(r#"{"thinking":"considering","signature":null}"#)
                .unwrap_or_else(|e| panic!("legacy thinking JSON loads: {e}"));
        let call: ToolCall =
            serde_json::from_str(r#"{"id":"call-1","name":"read_file","arguments":{}}"#)
                .unwrap_or_else(|e| panic!("legacy tool call JSON loads: {e}"));

        assert_eq!(thinking.started_at, None, "thinking start defaults");
        assert_eq!(thinking.finished_at, None, "thinking finish defaults");
        assert_eq!(call.started_at, None, "tool start defaults");
        assert_eq!(call.finished_at, None, "tool finish defaults");
        assert!(
            !serde_json::to_string(&call)
                .unwrap_or_default()
                .contains("started_at"),
            "absent timestamps stay out of stored JSON"
        );
    }
}
