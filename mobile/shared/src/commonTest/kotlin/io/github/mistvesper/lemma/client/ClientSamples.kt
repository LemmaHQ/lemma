package io.github.mistvesper.lemma.client

/** An OpenAI custom provider named and identified by [id] that offers [models]. */
fun sampleProvider(
    id: String,
    vararg models: String,
    enabled: Boolean = true,
    apiKey: String = "sk-test",
    name: String = id,
): ClientProvider =
    ClientProvider(
        id = id,
        enabled = enabled,
        apiKey = apiKey,
        source =
            ClientCustomProvider(
                identifier = id,
                name = name,
                apiFormat = ApiFormat.OpenAi,
                baseUrl = "https://api.example.com/v1",
                apiPath = "",
                modelsPath = "",
                models = models.map { ClientModel(it, toolCalling = true) },
            ),
    )

/** A predefined provider serving OpenAI and Anthropic formats with tool-capable [models]. */
fun samplePredefinedProvider(
    id: String,
    vararg models: String,
    enabled: Boolean = false,
    apiKey: String = "",
): ClientProvider =
    ClientProvider(
        id = id,
        enabled = enabled,
        apiKey = apiKey,
        source =
            ClientPredefinedProvider(
                identifier = id,
                name = id,
                apiFormats = listOf(ApiFormat.Anthropic, ApiFormat.OpenAi),
                defaultApiFormat = ApiFormat.Anthropic,
                models = models.map { ClientModel(it, toolCalling = true) },
            ),
    )

/** A settled message whose content is its [id]; a reply names the model that wrote it. */
fun sampleMessage(
    id: String,
    role: String,
    providerId: String? = null,
    model: String? = null,
    parentId: String? = null,
): ClientMessage =
    ClientMessage(
        id = id,
        role = role,
        content = id,
        providerId = providerId,
        model = model,
        parentId = parentId,
    )

/** A session titled [title], last updated at epoch millisecond [updatedAt]. */
fun sampleSession(
    id: String,
    title: String = id,
    updatedAt: Long = 0,
): ClientSession = ClientSession(id, title, updatedAt)
