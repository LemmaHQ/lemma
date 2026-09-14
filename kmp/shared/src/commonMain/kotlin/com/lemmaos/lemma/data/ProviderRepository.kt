package com.lemmaos.lemma.data

import com.lemmaos.lemma.domain.Provider
import kotlinx.coroutines.flow.StateFlow

interface ProviderRepository {
    val list: StateFlow<List<Provider>>

    suspend fun refresh()

    suspend fun create(input: NewProvider): Provider

    suspend fun update(id: String, patch: ProviderPatch)

    suspend fun remove(id: String)

    suspend fun fetchModels(request: FetchModelsRequest): List<String>
}

data class NewProvider(
    val kind: Int,
    val name: String,
    val baseUrl: String,
    val apiKey: String,
    val models: List<String>,
    val apiPath: String = "",
    val modelsPath: String = "",
)

data class ProviderPatch(
    val name: String? = null,
    val baseUrl: String? = null,
    // Left empty to keep the current key. Never prefill the masked display
    // value: the backend would seal it as if it were the real key.
    val apiKey: String? = null,
    val enabled: Boolean? = null,
    val models: List<String>? = null,
    val apiPath: String? = null,
    val modelsPath: String? = null,
)

data class FetchModelsRequest(
    val id: String? = null,
    val kind: Int? = null,
    val baseUrl: String? = null,
    val apiKey: String? = null,
    val modelsPath: String? = null,
)
