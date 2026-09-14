package com.lemmaos.lemma.rpc

import com.lemmaos.gen.lemma.v1.ProviderKind
import com.lemmaos.gen.lemma.v1.createProviderRequest
import com.lemmaos.gen.lemma.v1.deleteProviderRequest
import com.lemmaos.gen.lemma.v1.fetchModelsRequest
import com.lemmaos.gen.lemma.v1.listProvidersRequest
import com.lemmaos.gen.lemma.v1.providerModelsPatch
import com.lemmaos.gen.lemma.v1.updateProviderRequest
import com.lemmaos.lemma.data.FetchModelsRequest
import com.lemmaos.lemma.data.NewProvider
import com.lemmaos.lemma.data.ProviderPatch
import com.lemmaos.lemma.data.ProviderRepository
import com.lemmaos.lemma.data.SessionStore
import com.lemmaos.lemma.domain.Provider
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class ProviderRepositoryImpl(
    private val clients: ApiClients,
    private val session: SessionStore,
) : ProviderRepository {

    private val _list = MutableStateFlow<List<Provider>>(emptyList())
    override val list: StateFlow<List<Provider>> = _list.asStateFlow()

    override suspend fun refresh() {
        _list.value = clients.providers
            .listProviders(listProvidersRequest {}, emptyMap())
            .orThrowApp()
            .providersList
            .map { it.toDomain() }
    }

    override suspend fun create(input: NewProvider): Provider {
        val provider = clients.providers
            .createProvider(
                createProviderRequest {
                    kind = kindFromInt(input.kind)
                    name = input.name
                    baseUrl = input.baseUrl
                    apiKey = input.apiKey
                    models.addAll(input.models)
                    apiPath = input.apiPath
                    modelsPath = input.modelsPath
                },
                emptyMap(),
            )
            .orThrowApp()
            .provider
            .toDomain()
        _list.value = _list.value + provider
        return provider
    }

    override suspend fun update(id: String, patch: ProviderPatch) {
        val response = clients.providers
            .updateProvider(
                updateProviderRequest {
                    this.id = id
                    patch.name?.let { this.name = it }
                    patch.baseUrl?.let { baseUrl = it }
                    patch.apiKey?.takeIf { it.isNotEmpty() }?.let { apiKey = it }
                    patch.enabled?.let { enabled = it }
                    patch.models?.let { models = providerModelsPatch { models.addAll(it) } }
                    patch.apiPath?.let { apiPath = it }
                    patch.modelsPath?.let { modelsPath = it }
                },
                emptyMap(),
            )
            .orThrowApp()
        _list.value = _list.value.map {
            if (it.id == id) response.provider.toDomain() else it
        }
    }

    override suspend fun remove(id: String) {
        clients.providers.deleteProvider(deleteProviderRequest { this.id = id }, emptyMap())
            .orThrowApp()
        _list.value = _list.value.filterNot { it.id == id }
    }

    override suspend fun fetchModels(request: FetchModelsRequest): List<String> {
        return clients.providers
            .fetchModels(
                fetchModelsRequest {
                    request.id?.let { id = it }
                    request.kind?.let { kind = kindFromInt(it) }
                    request.baseUrl?.let { baseUrl = it }
                    request.apiKey?.let { apiKey = it }
                    request.modelsPath?.let { modelsPath = it }
                },
                emptyMap(),
            )
            .orThrowApp()
            .modelsList
    }

    private fun kindFromInt(value: Int) = when (value) {
        1 -> ProviderKind.PROVIDER_KIND_OPENAI
        2 -> ProviderKind.PROVIDER_KIND_ANTHROPIC
        3 -> ProviderKind.PROVIDER_KIND_GEMINI
        else -> ProviderKind.PROVIDER_KIND_UNSPECIFIED
    }
}

fun com.lemmaos.gen.lemma.v1.Provider.toDomain() = Provider(
    id = id,
    kind = when (kind) {
        ProviderKind.PROVIDER_KIND_OPENAI -> "openai"
        ProviderKind.PROVIDER_KIND_ANTHROPIC -> "anthropic"
        ProviderKind.PROVIDER_KIND_GEMINI -> "gemini"
        else -> "unknown"
    },
    name = name,
    baseUrl = baseUrl,
    apiKeyMasked = apiKey,
    models = modelsList,
    enabled = enabled,
    apiPath = apiPath,
    modelsPath = modelsPath,
)
