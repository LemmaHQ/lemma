package io.github.mistvesper.lemma.client

/** Input for creating a custom provider; `identifier` and `apiFormat` are immutable afterwards. */
data class ClientCustomProviderInput(
    val apiFormat: ApiFormat,
    val identifier: String,
    val name: String,
    val baseUrl: String,
    val apiKey: String = "",
    val apiPath: String = "",
    val modelsPath: String = "",
    val models: List<ClientModel> = emptyList(),
)
