use serde::{Deserialize, Serialize};

use crate::StopReason;
use crate::content::ToolCall;
use crate::usage::Usage;

/// One incremental event from a streaming provider call.
///
/// Adapters emit this closed set; consumers (UI, persistence, agent loop)
/// never see vendor-specific stream shapes. `tool_call_delta` carries raw
/// argument JSON fragments so UIs can preview arguments before they parse.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamEvent {
    /// Generation started.
    Start,
    /// A text block started.
    TextStart,
    /// A fragment of generated text.
    TextDelta {
        /// New text since the previous event.
        delta: String,
    },
    /// The current text block finished.
    TextEnd,
    /// A thinking block started.
    ThinkingStart,
    /// A fragment of reasoning text.
    ThinkingDelta {
        /// New reasoning text since the previous event.
        delta: String,
    },
    /// The current thinking block finished.
    ThinkingEnd {
        /// Opaque replay signature, when the provider issues one.
        signature: Option<String>,
    },
    /// A tool call started.
    ToolCallStart {
        /// Provider-assigned call id.
        id: String,
        /// Tool name.
        name: String,
    },
    /// A fragment of the tool call's argument JSON.
    ToolCallDelta {
        /// Call id from the matching start event.
        id: String,
        /// Raw JSON fragment.
        delta: String,
    },
    /// A tool call completed with fully parsed arguments.
    ToolCallEnd {
        /// The completed call.
        call: ToolCall,
    },
    /// Generation finished successfully.
    Done {
        /// Why generation stopped.
        stop_reason: StopReason,
        /// Token usage, when the provider reports it.
        usage: Option<Usage>,
    },
    /// Generation failed; partial content, if any, was already emitted.
    Error {
        /// Human-readable failure description.
        message: String,
    },
}
