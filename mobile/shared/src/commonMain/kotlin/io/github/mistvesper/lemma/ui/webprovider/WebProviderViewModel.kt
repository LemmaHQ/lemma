package io.github.mistvesper.lemma.ui.webprovider

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.mistvesper.lemma.client.ClientWebFunction
import io.github.mistvesper.lemma.client.ClientWebProvider
import io.github.mistvesper.lemma.client.ClientWebProviderKind
import io.github.mistvesper.lemma.client.ClientWebProviderPatch
import io.github.mistvesper.lemma.client.LemmaClient
import io.github.mistvesper.lemma.client.ServiceException
import io.github.mistvesper.lemma.i18n.UiText
import io.github.mistvesper.lemma.i18n.errorText
import io.github.mistvesper.lemma.ui.components.runOptimistic
import kotlinx.coroutines.launch

/** Loads web backends and edits their keys, enabled flags, and fallback order. */
internal class WebProviderViewModel(private val client: LemmaClient) : ViewModel() {

    var providers by mutableStateOf<List<ClientWebProvider>>(emptyList())
        private set

    var loading by mutableStateOf(true)
        private set

    var error by mutableStateOf<UiText?>(null)
        private set

    private var apiKeys by mutableStateOf<Map<String, String>>(emptyMap())
    private var saving by mutableStateOf<Set<String>>(emptySet())

    val searchProviders: List<ClientWebProvider>
        get() =
            providers.filter { it.kind != ClientWebProviderKind.Native }.sortedBy { it.searchRank }

    val fetchProviders: List<ClientWebProvider>
        get() = providers.sortedBy { it.fetchRank }

    init {
        viewModelScope.launch {
            try {
                providers = client.listWebProviders()
            } catch (e: ServiceException) {
                error = errorText(e.failure)
            } finally {
                loading = false
            }
        }
    }

    fun apiKey(id: String) = apiKeys[id] ?: providers.find { it.id == id }?.apiKey.orEmpty()

    fun hasUnsavedKey(id: String): Boolean {
        val provider = providers.find { it.id == id } ?: return false
        return apiKeys[id]?.let { it.trim() != provider.apiKey } == true
    }

    fun isSaving(id: String) = id in saving

    fun setApiKey(id: String, value: String) {
        apiKeys = apiKeys + (id to value)
    }

    fun discardApiKey(id: String) {
        apiKeys = apiKeys - id
    }

    fun saveApiKey(id: String) {
        if (!hasUnsavedKey(id) || id in saving) return
        val apiKey = apiKeys.getValue(id).trim()
        saving = saving + id
        error = null
        viewModelScope.launch {
            try {
                store(client.updateWebProvider(id, ClientWebProviderPatch(apiKey = apiKey)))
                apiKeys = apiKeys - id
            } catch (e: ServiceException) {
                error = errorText(e.failure)
            } finally {
                saving = saving - id
            }
        }
    }

    fun setEnabled(id: String, enabled: Boolean) {
        val provider = providers.find { it.id == id } ?: return
        if (enabled && provider.kind != ClientWebProviderKind.Native && provider.apiKey.isBlank()) {
            return
        }
        viewModelScope.runOptimistic(
            apply = { store(provider.copy(enabled = enabled)) },
            commit = {
                store(client.updateWebProvider(id, ClientWebProviderPatch(enabled = enabled)))
            },
            revert = { store(provider) },
            onError = { error = it },
        )
    }

    fun move(function: ClientWebFunction, id: String, direction: Int) {
        val ordered =
            when (function) {
                ClientWebFunction.Search -> searchProviders
                ClientWebFunction.Fetch -> fetchProviders
            }
        val from = ordered.indexOfFirst { it.id == id }
        if (from < 0) return
        val to = from + direction
        if (to !in ordered.indices) return
        val ids = ordered.map { it.id }.toMutableList()
        ids.add(to, ids.removeAt(from))
        error = null
        viewModelScope.launch {
            try {
                providers = client.setWebProviderOrder(function, ids)
            } catch (e: ServiceException) {
                error = errorText(e.failure)
            }
        }
    }

    private fun store(changed: ClientWebProvider) {
        providers = providers.map { if (it.id == changed.id) changed else it }
    }
}
