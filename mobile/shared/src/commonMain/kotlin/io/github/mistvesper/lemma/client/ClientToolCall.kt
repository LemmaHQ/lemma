package io.github.mistvesper.lemma.client

/**
 * A tool call an assistant message issued, with [arguments] as JSON text; the instants are epoch
 * milliseconds, null where the service recorded none.
 */
data class ClientToolCall(
    val id: String,
    val name: String,
    val arguments: String,
    val startedAt: Long? = null,
    val finishedAt: Long? = null,
)
