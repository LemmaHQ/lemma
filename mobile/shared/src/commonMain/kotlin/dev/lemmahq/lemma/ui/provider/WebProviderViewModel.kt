package dev.lemmahq.lemma.ui.provider

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.lemmahq.lemma.client.ClientWebFunction
import dev.lemmahq.lemma.client.ClientWebProvider
import dev.lemmahq.lemma.client.ClientWebProviderKind
import dev.lemmahq.lemma.client.ClientWebProviderPatch
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.i18n.UiText
import dev.lemmahq.lemma.i18n.errorText
import kotlinx.coroutines.launch

/** Loads web backends and edits their write-only keys, enabled flags, and fallback order. */
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

    fun apiKey(id: String) = apiKeys[id].orEmpty()

    fun hasUnsavedKey(id: String) = apiKey(id).isNotBlank()

    fun isSaving(id: String) = id in saving

    fun setApiKey(id: String, value: String) {
        apiKeys = apiKeys + (id to value)
    }

    fun discardApiKey(id: String) {
        apiKeys = apiKeys - id
    }

    fun saveApiKey(id: String) {
        val apiKey = apiKeys[id]?.trim().orEmpty()
        if (apiKey.isEmpty() || id in saving) return
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
        if (enabled && provider.kind != ClientWebProviderKind.Native && !provider.hasKey) {
            return
        }
        store(provider.copy(enabled = enabled))
        error = null
        viewModelScope.launch {
            try {
                store(client.updateWebProvider(id, ClientWebProviderPatch(enabled = enabled)))
            } catch (e: ServiceException) {
                store(provider)
                error = errorText(e.failure)
            }
        }
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
