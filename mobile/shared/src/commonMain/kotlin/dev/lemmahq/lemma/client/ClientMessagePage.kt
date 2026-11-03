package dev.lemmahq.lemma.client

/** One newest-first page of settled session messages. */
data class ClientMessagePage(
    val messages: List<ClientMessage>,
    val hasMore: Boolean,
)
