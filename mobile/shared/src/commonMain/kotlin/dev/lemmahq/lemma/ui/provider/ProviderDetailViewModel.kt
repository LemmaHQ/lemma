package dev.lemmahq.lemma.ui.provider

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.lemmahq.lemma.client.ClientCustomProvider
import dev.lemmahq.lemma.client.ClientCustomProviderPatch
import dev.lemmahq.lemma.client.ClientModel
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.i18n.UiText
import dev.lemmahq.lemma.i18n.errorText
import kotlinx.coroutines.launch

/** Edits one custom provider, saving connection fields together and other changes immediately. */
internal class ProviderDetailViewModel(
    private val client: LemmaClient,
    provider: ClientProvider,
    private val onChange: (ClientProvider) -> Unit,
    private val onDelete: (String) -> Unit,
) : ViewModel() {
    private var checked by mutableStateOf<Pair<String, CheckResult>?>(null)

    var provider by mutableStateOf(provider)
        private set

    val custom: ClientCustomProvider
        get() = provider.source as ClientCustomProvider

    var apiKey by mutableStateOf("")
    var baseUrl by mutableStateOf(custom.baseUrl)
    var apiPath by mutableStateOf(custom.apiPath)

    var saving by mutableStateOf(false)
        private set

    var error by mutableStateOf<UiText?>(null)
        private set

    var nameDraft by mutableStateOf<String?>(null)

    var renaming by mutableStateOf(false)
        private set

    var nameError by mutableStateOf<UiText?>(null)
        private set

    var pickedCheckModel by mutableStateOf<String?>(null)

    var fetching by mutableStateOf(false)
        private set

    var fetched by mutableStateOf<List<String>?>(null)
        private set

    val dirty: Boolean
        get() = connectionPatch() != ClientCustomProviderPatch()

    val baseUrlValid: Boolean
        get() = isBaseUrlValid(baseUrl)

    val nameChanged: Boolean
        get() = draftName()?.let { it != custom.name } ?: false

    val checkModel: String?
        get() =
            pickedCheckModel?.takeIf { picked -> custom.models.any { it.id == picked } }
                ?: custom.models.firstOrNull()?.id

    val checkResult: CheckResult?
        get() = checked?.takeIf { it.first == checkKey() }?.second

    fun save() {
        if (!dirty || !baseUrlValid || saving) return
        saving = true
        error = null
        viewModelScope.launch {
            try {
                show(client.updateCustomProvider(provider.id, connectionPatch()))
                checked = null
                discardEdits()
            } catch (e: ServiceException) {
                error = errorText(e.failure)
            } finally {
                saving = false
            }
        }
    }

    fun discardEdits() {
        apiKey = ""
        baseUrl = custom.baseUrl
        apiPath = custom.apiPath
        error = null
    }

    fun setEnabled(enabled: Boolean) {
        val previous = provider.enabled
        show(provider.copy(enabled = enabled))
        send(ClientCustomProviderPatch(enabled = enabled)) { it.copy(enabled = previous) }
    }

    fun openSettings() {
        nameDraft = custom.name
        nameError = null
    }

    fun closeSettings() {
        nameDraft = null
    }

    fun saveName() {
        val name = draftName() ?: return
        renaming = true
        nameError = null
        viewModelScope.launch {
            try {
                show(
                    client.updateCustomProvider(provider.id, ClientCustomProviderPatch(name = name))
                )
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
                client.deleteCustomProvider(provider.id)
                onDelete(provider.id)
            } catch (e: ServiceException) {
                error = errorText(e.failure)
            }
        }
    }

    fun addModel(model: String) {
        val id = model.trim()
        if (id.isNotEmpty() && custom.models.none { it.id == id }) {
            setModels(listOf(ClientModel(id, toolCalling = true)) + custom.models)
        }
    }

    fun removeModel(model: String) {
        setModels(custom.models.filterNot { it.id == model })
    }

    fun setToolCalling(model: String, toolCalling: Boolean) {
        setModels(
            custom.models.map {
                if (it.id == model) it.copy(toolCalling = toolCalling) else it
            }
        )
    }

    fun fetchModels() {
        if (dirty || fetching) return
        fetching = true
        error = null
        viewModelScope.launch {
            try {
                fetched = client.fetchModels(provider.id)
            } catch (e: ServiceException) {
                error = errorText(e.failure)
            } finally {
                fetching = false
            }
        }
    }

    fun addFetched(picked: List<String>) {
        fetched = null
        val added = picked.filterNot { id -> custom.models.any { it.id == id } }
        setModels(custom.models + added.map { ClientModel(it, toolCalling = true) })
    }

    fun dismissFetched() {
        fetched = null
    }

    fun check() {
        if (dirty) return
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

    private fun setModels(models: List<ClientModel>) {
        val previous = custom.models
        show(provider.copy(source = custom.copy(models = models)))
        send(ClientCustomProviderPatch(models = models)) { current ->
            current.copy(source = custom.copy(models = previous))
        }
    }

    private fun show(changed: ClientProvider) {
        provider = changed
        onChange(changed)
    }

    private fun send(patch: ClientCustomProviderPatch, revert: (ClientProvider) -> ClientProvider) {
        error = null
        viewModelScope.launch {
            try {
                client.updateCustomProvider(provider.id, patch)
            } catch (e: ServiceException) {
                show(revert(provider))
                error = errorText(e.failure)
            }
        }
    }

    private fun connectionPatch(): ClientCustomProviderPatch =
        ClientCustomProviderPatch(
            apiKey = apiKey.trim().takeIf { it.isNotEmpty() },
            baseUrl = baseUrl.trim().takeIf { it != custom.baseUrl },
            apiPath = apiPath.trim().takeIf { it != custom.apiPath },
        )

    private fun draftName(): String? = nameDraft?.let { it.trim().ifEmpty { custom.identifier } }

    private fun checkKey(): String =
        listOf(dirty, provider.hasKey, custom.baseUrl, custom.apiPath, checkModel)
            .joinToString("\n")
}
