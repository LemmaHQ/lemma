package io.github.mistvesper.lemma.client

/** A model provider as surfaced to the UI. */
data class ClientProvider(
    val id: String,
    val enabled: Boolean,
    val apiKey: String,
    val source: ClientProviderSource,
)
