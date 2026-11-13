package dev.lemmahq.lemma.network

import dev.lemmahq.gen.lemma.v1.CheckProviderRequest
import dev.lemmahq.gen.lemma.v1.CreateCustomProviderRequest
import dev.lemmahq.gen.lemma.v1.SetWebProviderOrderRequest
import dev.lemmahq.gen.lemma.v1.UpdateCustomProviderRequest
import dev.lemmahq.gen.lemma.v1.UpdatePredefinedProviderRequest
import dev.lemmahq.gen.lemma.v1.UpdateWebProviderRequest
import dev.lemmahq.gen.lemma.v1.checkProviderRequest
import dev.lemmahq.gen.lemma.v1.createCustomProviderRequest
import dev.lemmahq.gen.lemma.v1.providerModelsPatch
import dev.lemmahq.gen.lemma.v1.setWebProviderOrderRequest
import dev.lemmahq.gen.lemma.v1.updateCustomProviderRequest
import dev.lemmahq.gen.lemma.v1.updatePredefinedProviderRequest
import dev.lemmahq.gen.lemma.v1.updateWebProviderRequest
import dev.lemmahq.lemma.client.ClientCustomProviderInput
import dev.lemmahq.lemma.client.ClientCustomProviderPatch
import dev.lemmahq.lemma.client.ClientPredefinedProviderPatch
import dev.lemmahq.lemma.client.ClientWebFunction
import dev.lemmahq.lemma.client.ClientWebProviderPatch

internal fun customProviderCreateRequest(
    input: ClientCustomProviderInput
): CreateCustomProviderRequest = createCustomProviderRequest {
    apiFormat = apiFormat(input.apiFormat)
    identifier = input.identifier
    name = input.name
    baseUrl = input.baseUrl
    apiKey = input.apiKey
    apiPath = input.apiPath
    modelsPath = input.modelsPath
    models.addAll(input.models.map { it.toProto() })
}

internal fun customProviderUpdateRequest(
    id: String,
    patch: ClientCustomProviderPatch,
): UpdateCustomProviderRequest = updateCustomProviderRequest {
    this.id = id
    patch.name?.let { name = it }
    patch.baseUrl?.let { baseUrl = it }
    patch.apiKey?.let { apiKey = it }
    patch.apiPath?.let { apiPath = it }
    patch.modelsPath?.let { modelsPath = it }
    patch.enabled?.let { enabled = it }
    patch.models?.let { changed ->
        models = providerModelsPatch { models.addAll(changed.map { it.toProto() }) }
    }
}

internal fun predefinedProviderUpdateRequest(
    id: String,
    patch: ClientPredefinedProviderPatch,
): UpdatePredefinedProviderRequest = updatePredefinedProviderRequest {
    this.id = id
    patch.apiKey?.let { apiKey = it }
    patch.enabled?.let { enabled = it }
    patch.defaultApiFormat?.let { defaultApiFormat = apiFormat(it) }
}

internal fun webProviderUpdateRequest(
    id: String,
    patch: ClientWebProviderPatch,
): UpdateWebProviderRequest = updateWebProviderRequest {
    this.id = id
    patch.apiKey?.let { apiKey = it }
    patch.enabled?.let { enabled = it }
}

internal fun webProviderOrderRequest(
    function: ClientWebFunction,
    providerIds: List<String>,
): SetWebProviderOrderRequest = setWebProviderOrderRequest {
    this.function =
        when (function) {
            ClientWebFunction.Search -> SetWebProviderOrderRequest.Function.FUNCTION_SEARCH
            ClientWebFunction.Fetch -> SetWebProviderOrderRequest.Function.FUNCTION_FETCH
        }
    ids.addAll(providerIds)
}

internal fun storedProviderCheckRequest(id: String, model: String): CheckProviderRequest =
    checkProviderRequest {
        this.id = id
        this.model = model
    }
