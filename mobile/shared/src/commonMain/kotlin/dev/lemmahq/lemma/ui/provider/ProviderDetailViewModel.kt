package dev.lemmahq.lemma.ui.provider

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.ClientProviderInput
import dev.lemmahq.lemma.client.ClientProviderPatch
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.i18n.UiText
import dev.lemmahq.lemma.i18n.errorText
import kotlinx.coroutines.launch

/**
 * Edits one stored provider. The connection fields wait for [save]; the enabled flag and the model
 * list are saved as they change and revert when the service rejects them. [onChange] receives every
 * changed provider and [onDelete] the ID of the deleted one.
 */
internal class ProviderDetailViewModel(
    private val client: LemmaClient,
    provider: ClientProvider,
    private val onChange: (ClientProvider) -> Unit,
    private val onDelete: (String) -> Unit,
) : ViewModel() {
    private var checked by mutableStateOf<Pair<String, CheckResult>?>(null)

    var provider by mutableStateOf(provider)
        private set

    var apiKey by mutableStateOf(provider.apiKey)
    var baseUrl by mutableStateOf(provider.baseUrl)
    var apiPath by mutableStateOf(provider.apiPath)

    var saving by mutableStateOf(false)
        private set

    var error by mutableStateOf<UiText?>(null)
        private set

    /** The name in the provider settings dialog; null while the dialog is closed. */
    var nameDraft by mutableStateOf<String?>(null)

    var renaming by mutableStateOf(false)
        private set

    var nameError by mutableStateOf<UiText?>(null)
        private set

    /** The model the connectivity check uses; [checkModel] falls back to the first listed model. */
    var pickedCheckModel by mutableStateOf<String?>(null)

    var fetching by mutableStateOf(false)
        private set

    /** The live model list the last fetch returned, until models are picked from it. */
    var fetched by mutableStateOf<List<String>?>(null)
        private set

    /** Whether the connection fields differ from the stored provider. */
    val dirty: Boolean
        get() = connectionPatch() != ClientProviderPatch()

    val baseUrlValid: Boolean
        get() = isBaseUrlValid(baseUrl)

    /** Whether [nameDraft] would save a name other than the stored one. */
    val nameChanged: Boolean
        get() = draftName()?.let { it != provider.name } ?: false

    val checkModel: String?
        get() = pickedCheckModel?.takeIf { it in provider.models } ?: provider.models.firstOrNull()

    /** The result of the last check of the current connection fields and [checkModel]. */
    val checkResult: CheckResult?
        get() = checked?.takeIf { it.first == checkKey() }?.second

    fun save() {
        if (!dirty || !baseUrlValid || saving) return
        saving = true
        error = null
        viewModelScope.launch {
            try {
                show(client.updateProvider(provider.id, connectionPatch()))
                discardEdits()
            } catch (e: ServiceException) {
                error = errorText(e.failure)
            } finally {
                saving = false
            }
        }
    }

    /** Puts the stored connection values back into the fields. */
    fun discardEdits() {
        apiKey = provider.apiKey
        baseUrl = provider.baseUrl
        apiPath = provider.apiPath
        error = null
    }

    fun setEnabled(enabled: Boolean) {
        val previous = provider.enabled
        show(provider.copy(enabled = enabled))
        send(ClientProviderPatch(enabled = enabled)) { it.copy(enabled = previous) }
    }

    fun openSettings() {
        nameDraft = provider.name
        nameError = null
    }

    fun closeSettings() {
        nameDraft = null
    }

    /** Saves the name in [nameDraft]; a blank name saves the provider ID as the name. */
    fun saveName() {
        val name = draftName() ?: return
        renaming = true
        nameError = null
        viewModelScope.launch {
            try {
                show(client.updateProvider(provider.id, ClientProviderPatch(name = name)))
                nameDraft = null
            } catch (e: ServiceException) {
                nameError = errorText(e.failure)
            } finally {
                renaming = false
            }
        }
    }

    fun delete() {
        error = null
        viewModelScope.launch {
            try {
                client.deleteProvider(provider.id)
                onDelete(provider.id)
            } catch (e: ServiceException) {
                error = errorText(e.failure)
            }
        }
    }

    /** Lists [model] first unless it is blank or already listed. */
    fun addModel(model: String) {
        val id = model.trim()
        if (id.isNotEmpty() && id !in provider.models) setModels(listOf(id) + provider.models)
    }

    fun removeModel(model: String) {
        setModels(provider.models - model)
    }

    /** Fetches the live model list through the edited connection fields while [dirty]. */
    fun fetchModels() {
        fetching = true
        error = null
        viewModelScope.launch {
            try {
                fetched =
                    if (dirty) {
                        client.fetchModels(
                            provider.kind,
                            baseUrl.trim(),
                            apiKey.trim(),
                            provider.modelsPath,
                        )
                    } else {
                        client.fetchProviderModels(provider.id)
                    }
            } catch (e: ServiceException) {
                error = errorText(e.failure)
            } finally {
                fetching = false
            }
        }
    }

    /** Appends the [picked] models the list lacks and closes the fetched list. */
    fun addFetched(picked: List<String>) {
        fetched = null
        setModels(provider.models + picked.filterNot { it in provider.models })
    }

    fun dismissFetched() {
        fetched = null
    }

    /** Sends a test request for [checkModel] through the edited connection fields while [dirty]. */
    fun check() {
        val model = checkModel ?: return
        val key = checkKey()
        checked = key to CheckResult.Checking
        viewModelScope.launch {
            val result =
                try {
                    val id = if (dirty) null else provider.id
                    val failure = client.checkProvider(id, editedConnection(), model)
                    if (failure.isEmpty()) CheckResult.Passed
                    else CheckResult.Failed(UiText.Raw(failure))
                } catch (e: ServiceException) {
                    CheckResult.Failed(errorText(e.failure))
                }
            if (checked == key to CheckResult.Checking) checked = key to result
        }
    }

    private fun setModels(models: List<String>) {
        val previous = provider.models
        show(provider.copy(models = models))
        send(ClientProviderPatch(models = models)) { it.copy(models = previous) }
    }

    private fun show(changed: ClientProvider) {
        provider = changed
        onChange(changed)
    }

    private fun send(patch: ClientProviderPatch, revert: (ClientProvider) -> ClientProvider) {
        error = null
        viewModelScope.launch {
            try {
                client.updateProvider(provider.id, patch)
            } catch (e: ServiceException) {
                show(revert(provider))
                error = errorText(e.failure)
            }
        }
    }

    private fun connectionPatch(): ClientProviderPatch =
        ClientProviderPatch(
            apiKey = apiKey.trim().takeIf { it != provider.apiKey },
            baseUrl = baseUrl.trim().takeIf { it != provider.baseUrl },
            apiPath = apiPath.trim().takeIf { it != provider.apiPath },
        )

    private fun editedConnection(): ClientProviderInput =
        ClientProviderInput(
            kind = provider.kind,
            identifier = provider.identifier,
            name = provider.name,
            baseUrl = baseUrl.trim(),
            apiKey = apiKey.trim(),
            apiPath = apiPath.trim(),
        )

    private fun draftName(): String? = nameDraft?.let { it.trim().ifEmpty { provider.identifier } }

    private fun checkKey(): String =
        listOf(apiKey.trim(), baseUrl.trim(), apiPath.trim(), checkModel).joinToString("\n")
}
