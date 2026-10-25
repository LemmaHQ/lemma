package dev.lemmahq.lemma.client

/** A persisted message as surfaced to the UI. */
data class ClientMessage(
    val id: String,
    val role: String,
    val content: String,
    val providerId: String?,
    val model: String?,
    val createdAtSeconds: Long,
    val updatedAtSeconds: Long,
)
