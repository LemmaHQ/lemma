use serde::{Deserialize, Serialize};

use crate::content::{ContentBlock, ToolCall};
use crate::usage::Usage;

/// Why a generation ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StopReason {
    /// The model finished its response.
    Stop,
    /// Output hit the maximum token limit.
    Length,
    /// The model is calling tools and expects results.
    ToolUse,
    /// Generation failed.
    Error,
    /// The request was cancelled.
    Aborted,
}

/// One message in the canonical trace.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "role", rename_all = "snake_case")]
pub enum Message {
    /// A user-authored message.
    User {
        /// Message content blocks.
        content: Vec<ContentBlock>,
    },
    /// An assistant turn produced by a model.
    Assistant {
        /// Message content blocks.
        content: Vec<ContentBlock>,
        /// Why this turn ended.
        stop_reason: StopReason,
        /// Token usage for this turn, when reported.
        usage: Option<Usage>,
    },
    /// The result of executing a tool call.
    ToolResult {
        /// Id of the originating tool call.
        tool_call_id: String,
        /// Name of the executed tool.
        tool_name: String,
        /// Result content blocks (text and images).
        content: Vec<ContentBlock>,
        /// True when the tool reported a failure.
        is_error: bool,
    },
}

impl Message {
    /// Collects every tool call contained in an assistant message.
    pub fn tool_calls(&self) -> Vec<&ToolCall> {
        match self {
            Self::Assistant { content, .. } => content
                .iter()
                .filter_map(|b| match b {
                    ContentBlock::ToolCall(call) => Some(call),
                    _ => None,
                })
                .collect(),
            _ => Vec::new(),
        }
    }
}
