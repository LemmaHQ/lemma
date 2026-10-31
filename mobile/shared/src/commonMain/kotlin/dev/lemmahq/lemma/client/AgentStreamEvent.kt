package dev.lemmahq.lemma.client

/** One streamed event of an agent turn. */
sealed interface AgentStreamEvent {

    /** The user message has been committed. */
    data class Started(val messageId: String) : AgentStreamEvent

    /** An incremental text chunk. */
    data class Delta(val text: String) : AgentStreamEvent

    /** The turn completed and the assistant message persisted. */
    data object Done : AgentStreamEvent

    /** The turn was aborted by the user. */
    data object Aborted : AgentStreamEvent

    /** The turn failed. */
    data class Error(val message: String) : AgentStreamEvent
}
