package dev.lemmahq.lemma.client

/** An OpenAI provider named and identified by [id] that offers [models]. */
fun sampleProvider(id: String, vararg models: String, enabled: Boolean = true): ClientProvider =
    ClientProvider(
        id = id,
        kind = "openai",
        identifier = id,
        name = id,
        baseUrl = "https://api.example.com/v1",
        apiPath = "",
        modelsPath = "",
        models = models.toList(),
        enabled = enabled,
        apiKey = "sk-1",
    )

/** A settled message whose content is its [id]; a reply names the model that wrote it. */
fun sampleMessage(
    id: String,
    role: String,
    providerId: String? = null,
    model: String? = null,
): ClientMessage =
    ClientMessage(id = id, role = role, content = id, providerId = providerId, model = model)

/** A session titled [title], last updated at epoch millisecond [updatedAt]. */
fun sampleSession(id: String, title: String = id, updatedAt: Long = 0): ClientSession =
    ClientSession(id = id, title = title, updatedAt = updatedAt)
