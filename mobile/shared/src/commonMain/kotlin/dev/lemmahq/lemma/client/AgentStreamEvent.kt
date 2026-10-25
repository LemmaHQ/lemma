package dev.lemmahq.lemma.client

/** One streamed event of an agent turn. */
sealed interface AgentStreamEvent {

    /** The user message has been committed. */
    data class Started(val messageId: String) : AgentStreamEvent

    /** A new assistant message node started streaming. */
    data class TurnStarted(val messageId: String) : AgentStreamEvent

    /** An incremental text chunk. */
    data class Delta(val text: String) : AgentStreamEvent

    /** An incremental reasoning chunk. */
    data class ThinkingDelta(val text: String) : AgentStreamEvent

    /** A tool call is about to execute. */
    data class ToolStarted(val id: String, val name: String, val arguments: String) :
        AgentStreamEvent

    /** A tool call finished executing. */
    data class ToolFinished(
        val id: String,
        val name: String,
        val content: String,
        val isError: Boolean,
    ) : AgentStreamEvent

    /** The turn completed and the assistant message persisted. */
    data class Done(val promptTokens: Long, val completionTokens: Long) : AgentStreamEvent

    /** The turn was aborted by the user. */
    data object Aborted : AgentStreamEvent

    /** The turn failed. */
    data class Error(val message: String) : AgentStreamEvent
}
