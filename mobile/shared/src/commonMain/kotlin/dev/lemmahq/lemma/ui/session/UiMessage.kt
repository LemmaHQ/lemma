package dev.lemmahq.lemma.ui.session

import dev.lemmahq.lemma.client.ClientMessage
import dev.lemmahq.lemma.client.ClientToolResult
import dev.lemmahq.lemma.client.MessageStatus
import dev.lemmahq.lemma.i18n.UiText

/** Who wrote a message; the session view hides tool messages and shows them in the tool calls. */
internal enum class MessageRole {
    User,
    Assistant,
    Tool,
}

/**
 * A message as the session view shows it. [error] describes a message whose status is error; a tool
 * message answers the call in [toolResult] with its [content]. Instants are epoch milliseconds.
 */
internal data class UiMessage(
    val id: String,
    val role: MessageRole,
    val content: String,
    val thinking: String = "",
    val status: MessageStatus = MessageStatus.Done,
    val providerId: String? = null,
    val model: String? = null,
    val toolCalls: List<UiToolCall> = emptyList(),
    val toolResult: ClientToolResult? = null,
    val thinkingStartedAt: Long? = null,
    val thinkingFinishedAt: Long? = null,
    val error: UiText? = null,
)

/** A tool call with its [output] once it has returned; [isError] marks a failed call. */
internal data class UiToolCall(
    val id: String,
    val name: String,
    val arguments: String,
    val running: Boolean,
    val output: String = "",
    val isError: Boolean = false,
    val startedAt: Long? = null,
    val finishedAt: Long? = null,
)

internal fun ClientMessage.toUiMessage(): UiMessage =
    UiMessage(
        id = id,
        role =
            when (role) {
                "user" -> MessageRole.User
                "tool" -> MessageRole.Tool
                else -> MessageRole.Assistant
            },
        content = content,
        thinking = thinking,
        status = status,
        providerId = providerId,
        model = model,
        toolCalls =
            toolCalls.map {
                UiToolCall(
                    id = it.id,
                    name = it.name,
                    arguments = it.arguments,
                    running = false,
                    startedAt = it.startedAt,
                    finishedAt = it.finishedAt,
                )
            },
        toolResult = toolResult,
        thinkingStartedAt = thinkingStartedAt,
        thinkingFinishedAt = thinkingFinishedAt,
        error = error.takeIf { it.isNotEmpty() }?.let(UiText::Raw),
    )

/** These messages with each tool message's output and failure copied into the call it answers. */
internal fun List<UiMessage>.withToolResults(): List<UiMessage> {
    val results = mapNotNull { message ->
        message.toolResult?.let { it.toolCallId to (message.content to it.isError) }
    }
        .toMap()
    if (results.isEmpty()) return this
    return map { message ->
        if (message.role != MessageRole.Assistant || message.toolCalls.isEmpty()) {
            message
        } else {
            message.copy(
                toolCalls =
                    message.toolCalls.map { call ->
                        val (output, isError) = results[call.id] ?: return@map call
                        call.copy(output = output, isError = isError, running = false)
                    }
            )
        }
    }
}
