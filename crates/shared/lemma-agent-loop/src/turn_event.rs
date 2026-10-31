use chrono::{DateTime, Utc};
use lemma_core::Usage;
use uuid::Uuid;

/// Progress of a running turn, reported to its observer.
#[derive(Debug, Clone)]
pub enum TurnEvent {
    /// The user message has been committed to the tree.
    UserAppended {
        /// Message ID.
        id: Uuid,
    },
    /// A new assistant message node started streaming.
    AssistantStarted {
        /// Message ID.
        id: Uuid,
    },
    /// A text delta received from the model stream.
    Delta {
        /// Incremental chunk.
        delta: String,
        /// Server instant at which the delta arrived.
        at: DateTime<Utc>,
    },
    /// A reasoning delta received from the model stream.
    ThinkingDelta {
        /// Incremental reasoning chunk.
        delta: String,
        /// Server instant at which the delta arrived.
        at: DateTime<Utc>,
    },
    /// A tool call is about to be executed.
    ToolStarted {
        /// Provider-assigned call ID.
        id: String,
        /// Tool name.
        name: String,
        /// Call arguments as serialized JSON.
        arguments: String,
        /// Server instant at which execution started.
        at: DateTime<Utc>,
    },
    /// A tool call finished executing.
    ToolFinished {
        /// Provider-assigned call ID.
        id: String,
        /// Tool output text.
        content: String,
        /// True when the tool reported a failure.
        is_error: bool,
        /// Server instant at which the result arrived.
        at: DateTime<Utc>,
    },
    /// The turn was cancelled.
    TurnAborted {
        /// Server instant at which the turn stopped.
        at: DateTime<Utc>,
    },
    /// The model stream failed.
    TurnFailed {
        /// Model failure text.
        message: String,
        /// Server instant at which the stream failed.
        at: DateTime<Utc>,
    },
    /// The final assistant message has been completed and persisted.
    AssistantDone {
        /// Token usage if provided.
        usage: Option<Usage>,
        /// Server instant at which generation ended.
        at: DateTime<Utc>,
    },
}
