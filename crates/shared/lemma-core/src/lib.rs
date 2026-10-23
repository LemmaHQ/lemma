//! Canonical, provider-agnostic agent trace types.
//!
//! These types are the single language spoken by every layer of the system:
//! provider adapters translate vendor wire formats into them, the agent loop
//! appends them to the trace, and stores persist them verbatim. Nothing here
//! performs I/O.

mod content_block;
mod message;
mod stream_event;
mod tool_spec;
mod usage;

pub use content_block::{ContentBlock, ImageContent, TextContent, ThinkingContent, ToolCall};
pub use message::{Message, StopReason};
pub use stream_event::StreamEvent;
pub use tool_spec::ToolSpec;
pub use usage::Usage;
