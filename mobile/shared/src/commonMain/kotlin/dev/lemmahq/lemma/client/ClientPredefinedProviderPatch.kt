package dev.lemmahq.lemma.client

/** Patch input for the user-controlled fields of a predefined provider. */
data class ClientPredefinedProviderPatch(
    val apiKey: String? = null,
    val enabled: Boolean? = null,
    val defaultApiFormat: String? = null,
)
