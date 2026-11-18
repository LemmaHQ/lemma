package io.github.mistvesper.lemma.client

/**
 * A session summary; [title] is empty until the session is renamed, and [updatedAt] is the epoch
 * millisecond of its last change. [leafId] ends the active path, [directory] is the absolute
 * directory its tools run in, null for a generated workspace, and [activeMessageId] is the user
 * message of its running turn.
 */
data class ClientSession(
    val id: String,
    val title: String,
    val updatedAt: Long,
    val leafId: String? = null,
    val directory: String? = null,
    val activeMessageId: String? = null,
)
