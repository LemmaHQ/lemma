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
    },
    /// A reasoning delta received from the model stream.
    ThinkingDelta {
        /// Incremental reasoning chunk.
        delta: String,
    },
    /// A tool call is about to be executed.
    ToolStarted {
        /// Provider-assigned call ID.
        id: String,
        /// Tool name.
        name: String,
        /// Call arguments as serialized JSON.
        arguments: String,
    },
    /// A tool call finished executing.
    ToolFinished {
        /// Provider-assigned call ID.
        id: String,
        /// Tool name.
        name: String,
        /// Tool output text.
        content: String,
        /// True when the tool reported a failure.
        is_error: bool,
    },
    /// The final assistant message has been completed and persisted.
    AssistantDone {
        /// Message ID.
        id: Uuid,
        /// Token usage if provided.
        usage: Option<Usage>,
    },
}

/// Receives the events of one turn as they happen.
pub type TurnObserver<'a> = &'a (dyn Fn(TurnEvent) + Send + Sync);
