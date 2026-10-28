package dev.lemmahq.lemma.client

import dev.lemmahq.gen.lemma.v1.Provider
import dev.lemmahq.gen.lemma.v1.ProviderKind

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
    val hasApiKey: Boolean,
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

internal fun Provider.toClient(): ClientProvider {
    return ClientProvider(
        id = id,
        kind = providerKindString(kind),
        identifier = identifier,
        name = name,
        baseUrl = baseUrl,
        apiPath = apiPath,
        modelsPath = modelsPath,
        models = modelsList,
        enabled = enabled,
        hasApiKey = apiKey.isNotBlank(),
    )
}

private fun providerKindString(kind: ProviderKind): String {
    return when (kind) {
        ProviderKind.PROVIDER_KIND_OPENAI -> "openai"
        ProviderKind.PROVIDER_KIND_ANTHROPIC -> "anthropic"
        ProviderKind.PROVIDER_KIND_GEMINI -> "gemini"
        else -> throw IllegalArgumentException("Unknown provider kind: $kind")
    }
}

internal fun providerKindEnum(kind: String): ProviderKind {
    return when (kind) {
        "openai" -> ProviderKind.PROVIDER_KIND_OPENAI
        "anthropic" -> ProviderKind.PROVIDER_KIND_ANTHROPIC
        "gemini" -> ProviderKind.PROVIDER_KIND_GEMINI
        else -> throw IllegalArgumentException("Unknown provider kind: $kind")
    }
}
