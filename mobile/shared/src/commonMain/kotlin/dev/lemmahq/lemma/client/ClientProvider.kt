package dev.lemmahq.lemma.client

/** A model provider as surfaced to the UI without its API key. */
data class ClientProvider(
    val id: String,
    val enabled: Boolean,
    val hasKey: Boolean,
    val source: ClientProviderSource,
)
