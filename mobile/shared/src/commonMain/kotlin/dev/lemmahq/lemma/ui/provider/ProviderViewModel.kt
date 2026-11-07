package dev.lemmahq.lemma.ui.provider

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.i18n.UiText
import dev.lemmahq.lemma.i18n.errorText
import kotlinx.coroutines.launch

/**
 * Loads the account's providers for the AI provider pages, which report every provider they store
 * or delete through [store] and [remove].
 */
internal class ProviderViewModel(private val client: LemmaClient) : ViewModel() {

    var providers by mutableStateOf<List<ClientProvider>>(emptyList())
        private set

    var loading by mutableStateOf(true)
        private set

    var error by mutableStateOf<UiText?>(null)
        private set

    var query by mutableStateOf("")

    /** The providers whose name contains [query], ignoring case. */
    val matches: List<ClientProvider>
        get() = providers.filter { it.name.contains(query.trim(), ignoreCase = true) }

    init {
        viewModelScope.launch {
            try {
                providers = client.listProviders()
            } catch (e: ServiceException) {
                error = errorText(e.failure)
            } finally {
                loading = false
            }
        }
    }

    fun provider(id: String): ClientProvider? = providers.find { it.id == id }

    /** Replaces the provider with the ID of [provider], or appends [provider] when it is new. */
    fun store(provider: ClientProvider) {
        providers =
            if (providers.any { it.id == provider.id }) {
                providers.map { if (it.id == provider.id) provider else it }
            } else {
                providers + provider
            }
    }

    fun remove(id: String) {
        providers = providers.filterNot { it.id == id }
    }
}
