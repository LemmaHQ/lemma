package dev.lemmahq.lemma.client

/**
 * One streamed event of an agent turn, in the order the service logged it. [occurredAt] is the
 * service instant in epoch milliseconds, null when the service sent none.
 */
sealed interface AgentStreamEvent {
    val occurredAt: Long?

    /** The user message [messageId] has been committed; the turn is known by this id. */
    data class Started(val messageId: String, override val occurredAt: Long? = null) :
        AgentStreamEvent

    /** A step of the turn began writing the assistant message [messageId]. */
    data class TurnStarted(val messageId: String, override val occurredAt: Long? = null) :
        AgentStreamEvent

    data class TextDelta(val text: String, override val occurredAt: Long? = null) : AgentStreamEvent

    data class ThinkingDelta(val text: String, override val occurredAt: Long? = null) :
        AgentStreamEvent

    /** The current step called tool [name] with [arguments] as JSON text. */
    data class ToolCallStarted(
        val callId: String,
        val name: String,
        val arguments: String,
        override val occurredAt: Long? = null,
    ) : AgentStreamEvent

    /** Tool call [callId] returned [content], which describes the failure when [isError]. */
    data class ToolCallFinished(
        val callId: String,
        val content: String,
        val isError: Boolean,
        override val occurredAt: Long? = null,
    ) : AgentStreamEvent

    /** The turn completed and its messages are stored. */
    data class Done(override val occurredAt: Long? = null) : AgentStreamEvent

    /** The turn was stopped by an abort. */
    data class Aborted(override val occurredAt: Long? = null) : AgentStreamEvent

    /** The turn failed with [message]. */
    data class Error(val message: String, override val occurredAt: Long? = null) : AgentStreamEvent

    /** An event kind this client does not know; it still counts toward a resume offset. */
    data class Unknown(override val occurredAt: Long? = null) : AgentStreamEvent
}
