package dev.lemmahq.lemma.ui.provider

import dev.lemmahq.lemma.client.ApiFormat

private val BASE_URL_PATTERN = Regex("""^https?://\S+$""")

/** Whether [baseUrl] names an HTTP or HTTPS endpoint. */
internal fun isBaseUrlValid(baseUrl: String): Boolean = BASE_URL_PATTERN.matches(baseUrl.trim())

/** Whether [baseUrl] is filled in but is not an HTTP or HTTPS endpoint. */
internal fun isBaseUrlInvalid(baseUrl: String): Boolean =
    baseUrl.isNotBlank() && !isBaseUrlValid(baseUrl)

/**
 * The example base URL and the default request path a provider of one API format shows as hints.
 */
internal data class ConnectionPlaceholders(val baseUrl: String, val apiPath: String)

internal fun connectionPlaceholders(apiFormat: ApiFormat): ConnectionPlaceholders =
    when (apiFormat) {
        ApiFormat.OpenAi ->
            ConnectionPlaceholders("https://api.example.com/v1", "/chat/completions")
        ApiFormat.Anthropic -> ConnectionPlaceholders("https://api.example.com", "/v1/messages")
        ApiFormat.Gemini ->
            ConnectionPlaceholders("https://api.example.com", "/v1beta/models/{model}:…")
    }
