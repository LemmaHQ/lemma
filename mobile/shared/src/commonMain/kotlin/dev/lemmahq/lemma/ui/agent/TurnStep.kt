package dev.lemmahq.lemma.ui.agent

import dev.lemmahq.lemma.client.MessageStatus

private val ARGUMENT_KEYS =
    mapOf(
        "read_file" to "path",
        "write_file" to "path",
        "bash" to "command",
        "web_search" to "query",
        "web_fetch" to "url",
    )

/**
 * One row of a reply's step timeline: an assistant message's thinking, or a tool call when
 * [toolName] is set. [argument] is the short text the row shows; [detail] the full content it
 * opens. A failed call is [selfHealed] when a later call succeeded or a later step settled the
 * reply. Instants are epoch milliseconds.
 */
internal data class TurnStep(
    val id: String,
    val toolName: String?,
    val argument: String,
    val startedAt: Long?,
    val finishedAt: Long?,
    val running: Boolean,
    val detail: StepDetail,
    val via: String? = null,
    val isError: Boolean = false,
    val selfHealed: Boolean = false,
) {
    /** Whether [argument] reads as prose rather than code: thinking and web search queries. */
    val plainArgument
        get() = toolName == null || toolName == "web_search"
}

/** The steps of a reply's assistant [messages] in the order they happened. */
internal fun buildTurnSteps(messages: List<UiMessage>): List<TurnStep> {
    val calls = messages.flatMap { it.toolCalls }
    val lastSuccess = calls.indexOfLast { !it.running && !it.isError }
    val settled = messages.lastOrNull()?.status == MessageStatus.Done
    return buildList {
        var callIndex = 0
        messages.forEachIndexed { index, message ->
            if (message.thinking.isNotEmpty() || message.thinkingStartedAt != null) {
                add(thinkingStep(message))
            }
            val laterStepSettled = settled && index < messages.lastIndex
            for (call in message.toolCalls) {
                add(toolStep(call, call.isError && (laterStepSettled || callIndex < lastSuccess)))
                callIndex++
            }
        }
    }
}

/** The display argument of a call to [name]: its path, command, query, or URL, else [arguments]. */
internal fun formatToolArgument(name: String, arguments: String): String {
    val key = ARGUMENT_KEYS[name] ?: return arguments
    return parseJsonObject(arguments)?.nonEmptyString(key) ?: arguments
}

private fun thinkingStep(message: UiMessage) =
    TurnStep(
        id = "${message.id}:thinking",
        toolName = null,
        argument =
            message.thinking.lineSequence().firstOrNull { it.isNotBlank() }?.trim().orEmpty(),
        startedAt = message.thinkingStartedAt,
        finishedAt = message.thinkingFinishedAt,
        running = message.status == MessageStatus.Streaming && message.thinkingFinishedAt == null,
        detail = StepDetail.Prose(message.thinking),
    )

private fun toolStep(call: UiToolCall, selfHealed: Boolean): TurnStep {
    val argument = formatToolArgument(call.name, call.arguments)
    val output = parseToolOutput(call, argument)
    return TurnStep(
        id = call.id,
        toolName = call.name,
        argument = argument,
        startedAt = call.startedAt,
        finishedAt = call.finishedAt,
        running = call.running,
        detail = output.detail,
        via = output.via,
        isError = call.isError,
        selfHealed = selfHealed,
    )
}
