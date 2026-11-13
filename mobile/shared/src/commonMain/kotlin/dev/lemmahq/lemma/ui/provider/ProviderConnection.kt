package dev.lemmahq.lemma.ui.provider

internal val API_FORMATS = listOf("openai", "anthropic", "gemini")

private val BASE_URL_PATTERN = Regex("""^https?://\S+$""")

/** Whether [baseUrl] names an HTTP or HTTPS endpoint. */
internal fun isBaseUrlValid(baseUrl: String): Boolean = BASE_URL_PATTERN.matches(baseUrl.trim())

/**
 * The example base URL and the default request path a provider of one API format shows as hints.
 */
internal data class ConnectionPlaceholders(val baseUrl: String, val apiPath: String)

internal fun connectionPlaceholders(apiFormat: String): ConnectionPlaceholders =
    when (apiFormat) {
        "anthropic" -> ConnectionPlaceholders("https://api.example.com", "/v1/messages")
        "gemini" -> ConnectionPlaceholders("https://api.example.com", "/v1beta/models/{model}:…")
        else -> ConnectionPlaceholders("https://api.example.com/v1", "/chat/completions")
    }
