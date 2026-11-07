package dev.lemmahq.lemma.client

import kotlinx.serialization.Serializable

/**
 * A stored session message. [role] is `user`, `assistant`, `system`, or `tool`; an assistant
 * message holds its [toolCalls], and a tool message answers one of them in [toolResult]. Instants
 * are epoch milliseconds, null where the service recorded none.
 */
@Serializable
data class ClientMessage(
    val id: String,
    val role: String,
    val content: String,
    val thinking: String = "",
    val status: MessageStatus = MessageStatus.Done,
    val error: String = "",
    val providerId: String? = null,
    val model: String? = null,
    val toolCalls: List<ClientToolCall> = emptyList(),
    val toolResult: ClientToolResult? = null,
    val thinkingStartedAt: Long? = null,
    val thinkingFinishedAt: Long? = null,
)
