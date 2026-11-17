package dev.lemmahq.lemma.ui.provider

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.lemmahq.lemma.client.ApiFormat
import dev.lemmahq.lemma.client.ClientPredefinedProvider
import dev.lemmahq.lemma.client.ClientPredefinedProviderPatch
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.i18n.UiText
import dev.lemmahq.lemma.i18n.errorText
import dev.lemmahq.lemma.ui.components.runOptimistic
import kotlinx.coroutines.launch

/** Edits the key, enabled flag, and default API format of one predefined provider. */
internal class PredefinedProviderDetailViewModel(
    private val client: LemmaClient,
    initial: ClientProvider,
    private val onChange: (ClientProvider) -> Unit,
) : ViewModel() {

    var provider by mutableStateOf(initial)
        private set

    val predefined: ClientPredefinedProvider
        get() = provider.source as ClientPredefinedProvider

    var apiKey by mutableStateOf(provider.apiKey)

    var saving by mutableStateOf(false)
        private set

    var error by mutableStateOf<UiText?>(null)
        private set

    var pickedCheckModel by mutableStateOf<String?>(null)

    val dirty: Boolean
        get() = apiKey.trim() != provider.apiKey

    val canEnable: Boolean
        get() = provider.apiKey.isNotBlank()

    private val check =
        ProviderCheck(client, viewModelScope, { provider }, { pickedCheckModel }, { !dirty }) {
            listOf(!dirty, provider.apiKey, predefined.defaultApiFormat).joinToString("\n")
        }

    val checkModel: String?
        get() = check.model

    val checkResult: CheckResult?
        get() = check.result

    fun save() {
        if (!dirty || saving) return
        saving = true
        error = null
        viewModelScope.launch {
            try {
                show(
                    client.updatePredefinedProvider(
                        provider.id,
                        ClientPredefinedProviderPatch(apiKey = apiKey.trim()),
                    )
                )
                check.clear()
                discardEdits()
            } catch (e: ServiceException) {
                error = errorText(e.failure)
            } finally {
                saving = false
            }
        }
    }

    fun discardEdits() {
        apiKey = provider.apiKey
        error = null
    }

    fun setEnabled(enabled: Boolean) {
        if (enabled && !canEnable) return
        val previous = provider.enabled
        viewModelScope.runOptimistic(
            apply = { show(provider.copy(enabled = enabled)) },
            commit = {
                client.updatePredefinedProvider(
                    provider.id,
                    ClientPredefinedProviderPatch(enabled = enabled),
                )
            },
            revert = { show(provider.copy(enabled = previous)) },
            onError = { error = it },
        )
    }

    fun setDefaultApiFormat(apiFormat: ApiFormat) {
        val previous = predefined.defaultApiFormat
        viewModelScope.runOptimistic(
            apply = {
                show(provider.copy(source = predefined.copy(defaultApiFormat = apiFormat)))
            },
            commit = {
                client.updatePredefinedProvider(
                    provider.id,
                    ClientPredefinedProviderPatch(defaultApiFormat = apiFormat),
                )
            },
            revert = {
                show(provider.copy(source = predefined.copy(defaultApiFormat = previous)))
            },
            onError = { error = it },
        )
    }

    fun check() = check.run()

    private fun show(changed: ClientProvider) {
        provider = changed
        onChange(changed)
    }
}
