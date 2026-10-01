//! Canonical, provider-agnostic agent trace types.
//!
//! These types are the single language spoken by every layer of the system:
//! provider adapters translate vendor wire formats into them, the agent loop
//! appends them to the trace, and stores persist them verbatim. Nothing here
//! performs I/O; the crate depends on serde only.

mod content;
mod event;
mod message;
mod usage;

pub use content::{ContentBlock, ImageContent, TextContent, ThinkingContent, ToolCall};
pub use event::StreamEvent;
pub use message::{Message, StopReason};
pub use usage::Usage;
