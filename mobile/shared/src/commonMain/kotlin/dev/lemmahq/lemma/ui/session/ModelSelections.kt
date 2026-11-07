package dev.lemmahq.lemma.ui.session

import dev.lemmahq.lemma.client.ClientMessage
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.data.ModelSelection

/** Whether an enabled provider in [providers] offers this model. */
internal fun ModelSelection.isOffered(providers: List<ClientProvider>): Boolean = providers.any {
    it.id == providerId && it.enabled && model in it.models
}

/** [stored] when it is still offered, else the first model of the first enabled provider. */
internal fun defaultSelection(
    providers: List<ClientProvider>,
    stored: ModelSelection?,
): ModelSelection? =
    stored?.takeIf { it.isOffered(providers) }
        ?: providers
            .firstOrNull { it.enabled && it.models.isNotEmpty() }
            ?.let { ModelSelection(it.id, it.models.first()) }

/** The model of the newest assistant message in [newestFirst], when it is still offered. */
internal fun lastUsedSelection(
    newestFirst: List<ClientMessage>,
    providers: List<ClientProvider>,
): ModelSelection? {
    val (providerId, model) =
        newestFirst
            .filter { it.role == "assistant" }
            .firstNotNullOfOrNull { reply -> reply.model?.let { reply.providerId to it } }
            ?: return null
    return ModelSelection(providerId ?: return null, model).takeIf { it.isOffered(providers) }
}
