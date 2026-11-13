package dev.lemmahq.lemma.ui.provider

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.lemmahq.lemma.client.ClientPredefinedProvider
import dev.lemmahq.lemma.client.ClientPredefinedProviderPatch
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.i18n.UiText
import dev.lemmahq.lemma.i18n.errorText
import kotlinx.coroutines.launch

/** Edits the key, enabled flag, and default API format of one predefined provider. */
internal class PredefinedProviderDetailViewModel(
    private val client: LemmaClient,
    provider: ClientProvider,
    private val onChange: (ClientProvider) -> Unit,
) : ViewModel() {
    private var checked by mutableStateOf<Pair<String, CheckResult>?>(null)

    var provider by mutableStateOf(provider)
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

    val checkModel: String?
        get() =
            pickedCheckModel?.takeIf { picked -> predefined.models.any { it.id == picked } }
                ?: predefined.models.firstOrNull()?.id

    val checkResult: CheckResult?
        get() = checked?.takeIf { it.first == checkKey() }?.second

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
        show(provider.copy(enabled = enabled))
        send(ClientPredefinedProviderPatch(enabled = enabled)) {
            it.copy(enabled = previous)
        }
    }

    fun setDefaultApiFormat(apiFormat: String) {
        val previous = predefined.defaultApiFormat
        show(provider.copy(source = predefined.copy(defaultApiFormat = apiFormat)))
        send(ClientPredefinedProviderPatch(defaultApiFormat = apiFormat)) { current ->
            current.copy(source = predefined.copy(defaultApiFormat = previous))
        }
    }

    fun check() {
        val model = checkModel ?: return
        val key = checkKey()
        checked = key to CheckResult.Checking
        viewModelScope.launch {
            val result =
                try {
                    val failure = client.checkProvider(provider.id, model)
                    if (failure.isEmpty()) CheckResult.Passed
                    else CheckResult.Failed(UiText.Raw(failure))
                } catch (e: ServiceException) {
                    CheckResult.Failed(errorText(e.failure))
                }
            if (checked == key to CheckResult.Checking) checked = key to result
        }
    }

    private fun show(changed: ClientProvider) {
        provider = changed
        onChange(changed)
    }

    private fun send(
        patch: ClientPredefinedProviderPatch,
        revert: (ClientProvider) -> ClientProvider,
    ) {
        error = null
        viewModelScope.launch {
            try {
                client.updatePredefinedProvider(provider.id, patch)
            } catch (e: ServiceException) {
                show(revert(provider))
                error = errorText(e.failure)
            }
        }
    }

    private fun checkKey(): String = listOf(provider.apiKey, checkModel).joinToString("\n")
}
