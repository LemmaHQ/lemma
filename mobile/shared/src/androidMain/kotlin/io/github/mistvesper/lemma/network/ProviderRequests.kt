package io.github.mistvesper.lemma.network

import io.github.mistvesper.gen.lemma.v1.CheckProviderRequest
import io.github.mistvesper.gen.lemma.v1.CreateCustomProviderRequest
import io.github.mistvesper.gen.lemma.v1.SetWebProviderOrderRequest
import io.github.mistvesper.gen.lemma.v1.UpdateCustomProviderRequest
import io.github.mistvesper.gen.lemma.v1.UpdatePredefinedProviderRequest
import io.github.mistvesper.gen.lemma.v1.UpdateWebProviderRequest
import io.github.mistvesper.gen.lemma.v1.checkProviderRequest
import io.github.mistvesper.gen.lemma.v1.createCustomProviderRequest
import io.github.mistvesper.gen.lemma.v1.providerModelsPatch
import io.github.mistvesper.gen.lemma.v1.setWebProviderOrderRequest
import io.github.mistvesper.gen.lemma.v1.updateCustomProviderRequest
import io.github.mistvesper.gen.lemma.v1.updatePredefinedProviderRequest
import io.github.mistvesper.gen.lemma.v1.updateWebProviderRequest
import io.github.mistvesper.lemma.client.ClientCustomProviderInput
import io.github.mistvesper.lemma.client.ClientCustomProviderPatch
import io.github.mistvesper.lemma.client.ClientPredefinedProviderPatch
import io.github.mistvesper.lemma.client.ClientWebFunction
import io.github.mistvesper.lemma.client.ClientWebProviderPatch

internal fun customProviderCreateRequest(
    input: ClientCustomProviderInput
): CreateCustomProviderRequest = createCustomProviderRequest {
    apiFormat = input.apiFormat.toProto()
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
    patch.defaultApiFormat?.let { defaultApiFormat = it.toProto() }
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
