package io.github.mistvesper.lemma.client

/** Provider configuration whose category determines which fields the user can edit. */
sealed interface ClientProviderSource {
    val identifier: String
    val name: String
    val models: List<ClientModel>
}

/** A predefined provider whose formats and models ship with Lemma. */
data class ClientPredefinedProvider(
    override val identifier: String,
    override val name: String,
    val apiFormats: List<ApiFormat>,
    val defaultApiFormat: ApiFormat,
    override val models: List<ClientModel>,
) : ClientProviderSource

/** A custom provider with one immutable API format and editable connection fields. */
data class ClientCustomProvider(
    override val identifier: String,
    override val name: String,
    val apiFormat: ApiFormat,
    val baseUrl: String,
    val apiPath: String,
    val modelsPath: String,
    override val models: List<ClientModel>,
) : ClientProviderSource
