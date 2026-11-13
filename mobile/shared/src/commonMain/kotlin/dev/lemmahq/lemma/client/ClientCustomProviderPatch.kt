package dev.lemmahq.lemma.client

/** Patch input for updating a custom provider; null fields keep current values. */
data class ClientCustomProviderPatch(
    val name: String? = null,
    val baseUrl: String? = null,
    val apiKey: String? = null,
    val apiPath: String? = null,
    val modelsPath: String? = null,
    val enabled: Boolean? = null,
    val models: List<ClientModel>? = null,
)
