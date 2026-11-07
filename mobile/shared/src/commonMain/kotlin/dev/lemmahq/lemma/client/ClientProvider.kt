package dev.lemmahq.lemma.client

/** A model provider as surfaced to the UI. */
data class ClientProvider(
    val id: String,
    val kind: String,
    val identifier: String,
    val name: String,
    val baseUrl: String,
    val apiPath: String,
    val modelsPath: String,
    val models: List<String>,
    val enabled: Boolean,
    val apiKey: String,
)

/** Input for creating a provider; `identifier` is immutable afterwards. */
data class ClientProviderInput(
    val kind: String,
    val identifier: String,
    val name: String,
    val baseUrl: String,
    val apiKey: String = "",
    val apiPath: String = "",
    val modelsPath: String = "",
    val models: List<String> = emptyList(),
)

/** Patch input for updating a provider; null fields keep current values. */
data class ClientProviderPatch(
    val name: String? = null,
    val baseUrl: String? = null,
    val apiKey: String? = null,
    val apiPath: String? = null,
    val modelsPath: String? = null,
    val enabled: Boolean? = null,
    val models: List<String>? = null,
)
