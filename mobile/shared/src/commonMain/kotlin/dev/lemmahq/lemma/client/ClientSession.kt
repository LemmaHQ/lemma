package dev.lemmahq.lemma.client

/**
 * A session summary; [title] is empty until the session is renamed, and [updatedAt] is the epoch
 * millisecond of its last change.
 */
data class ClientSession(
    val id: String,
    val title: String,
    val updatedAt: Long,
)
