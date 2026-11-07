package dev.lemmahq.lemma.ui.session

import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.MessageStatus
import dev.lemmahq.lemma.i18n.UiText

/**
 * Applies one turn's stream events to the shown messages. Events write into the reply, the
 * assistant message the turn writes now: first the placeholder [replyId], then the message each
 * [AgentStreamEvent.TurnStarted] names. A new reply carries [providerId] and [model].
 */
internal class TurnReducer(
    private val providerId: String,
    private val model: String,
    replyId: String,
) {
    var replyId = replyId
        private set

    fun apply(messages: List<UiMessage>, event: AgentStreamEvent): List<UiMessage> {
        val at = event.occurredAt
        return when (event) {
            is AgentStreamEvent.Started,
            is AgentStreamEvent.Unknown -> messages
            is AgentStreamEvent.TurnStarted -> startStep(messages, event.messageId)
            is AgentStreamEvent.TextDelta ->
                messages.withReply {
                    it.copy(
                        content = it.content + event.text,
                        thinkingFinishedAt = it.thinkingEnd(at),
                    )
                }
            is AgentStreamEvent.ThinkingDelta ->
                messages.withReply {
                    it.copy(
                        thinking = it.thinking + event.text,
                        thinkingStartedAt = it.thinkingStartedAt ?: at,
                    )
                }
            is AgentStreamEvent.ToolCallStarted ->
                messages.withReply {
                    it.copy(
                        thinkingFinishedAt = it.thinkingEnd(at),
                        toolCalls = it.toolCalls + event.toToolCall(),
                    )
                }
            is AgentStreamEvent.ToolCallFinished ->
                messages.withReply { reply ->
                    reply.copy(toolCalls = reply.toolCalls.map { it.finishedBy(event) })
                }
            is AgentStreamEvent.Done -> messages.withReplyEnded(MessageStatus.Done, at)
            is AgentStreamEvent.Aborted -> messages.withReplyEnded(MessageStatus.Aborted, at)
            is AgentStreamEvent.Error ->
                messages.withReply {
                    it.copy(
                        status = MessageStatus.Error,
                        error = UiText.Raw(event.message),
                        thinkingFinishedAt = it.thinkingEnd(at),
                    )
                }
        }
    }

    /** The messages after the turn ended without its stream for [error]. */
    fun fail(messages: List<UiMessage>, error: UiText): List<UiMessage> = messages.withReply {
        it.copy(status = MessageStatus.Error, error = error)
    }

    /**
     * Moves the reply to the step [messageId]: the empty placeholder takes its id, while a reply
     * that already shows content is settled, since the service settles a step before the next.
     */
    private fun startStep(messages: List<UiMessage>, messageId: String): List<UiMessage> {
        val empty = messages.any {
            it.id == replyId &&
                it.content.isEmpty() &&
                it.thinking.isEmpty() &&
                it.toolCalls.isEmpty()
        }
        val next =
            if (empty) {
                messages.withReply { it.copy(id = messageId) }
            } else {
                messages.withReply { it.copy(status = MessageStatus.Done) } +
                    UiMessage(
                        id = messageId,
                        role = MessageRole.Assistant,
                        content = "",
                        status = MessageStatus.Streaming,
                        providerId = providerId,
                        model = model,
                    )
            }
        replyId = messageId
        return next
    }

    private fun List<UiMessage>.withReplyEnded(status: MessageStatus, at: Long?): List<UiMessage> =
        withReply {
            it.copy(status = status, thinkingFinishedAt = it.thinkingEnd(at))
        }

    private inline fun List<UiMessage>.withReply(
        update: (UiMessage) -> UiMessage
    ): List<UiMessage> = map { if (it.id == replyId) update(it) else it }
}

/** When the reply's thinking ended: kept once set, [at] for thinking that is still open. */
private fun UiMessage.thinkingEnd(at: Long?): Long? =
    if (thinkingStartedAt == null) null else thinkingFinishedAt ?: at

private fun AgentStreamEvent.ToolCallStarted.toToolCall(): UiToolCall =
    UiToolCall(
        id = callId,
        name = name,
        arguments = arguments,
        running = true,
        startedAt = occurredAt,
    )

private fun UiToolCall.finishedBy(event: AgentStreamEvent.ToolCallFinished): UiToolCall =
    if (id != event.callId) this
    else
        copy(
            output = event.content,
            isError = event.isError,
            running = false,
            finishedAt = event.occurredAt,
        )
