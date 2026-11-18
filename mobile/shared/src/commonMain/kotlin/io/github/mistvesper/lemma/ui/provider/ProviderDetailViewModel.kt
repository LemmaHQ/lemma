package io.github.mistvesper.lemma.ui.provider

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.mistvesper.lemma.client.ClientCustomProvider
import io.github.mistvesper.lemma.client.ClientCustomProviderPatch
import io.github.mistvesper.lemma.client.ClientModel
import io.github.mistvesper.lemma.client.ClientProvider
import io.github.mistvesper.lemma.client.LemmaClient
import io.github.mistvesper.lemma.client.ServiceException
import io.github.mistvesper.lemma.i18n.UiText
import io.github.mistvesper.lemma.i18n.errorText
import io.github.mistvesper.lemma.ui.components.runOptimistic
import kotlinx.coroutines.launch

/** Edits one custom provider, saving connection fields together and other changes immediately. */
internal class ProviderDetailViewModel(
    private val client: LemmaClient,
    initial: ClientProvider,
    private val onChange: (ClientProvider) -> Unit,
    private val onDelete: (String) -> Unit,
) : ViewModel() {

    var provider by mutableStateOf(initial)
        private set

    val custom: ClientCustomProvider
        get() = provider.source as ClientCustomProvider

    var apiKey by mutableStateOf(provider.apiKey)
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

    private val check =
        ProviderCheck(client, viewModelScope, { provider }, { pickedCheckModel }, { !dirty }) {
            listOf(!dirty, provider.apiKey, custom.baseUrl, custom.apiPath).joinToString("\n")
        }

    val checkModel: String?
        get() = check.model

    val checkResult: CheckResult?
        get() = check.result

    fun save() {
        if (!dirty || !baseUrlValid || saving) return
        saving = true
        error = null
        viewModelScope.launch {
            try {
                show(client.updateCustomProvider(provider.id, connectionPatch()))
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
        baseUrl = custom.baseUrl
        apiPath = custom.apiPath
        error = null
    }

    fun setEnabled(enabled: Boolean) {
        val previous = provider.enabled
        viewModelScope.runOptimistic(
            apply = { show(provider.copy(enabled = enabled)) },
            commit = {
                client.updateCustomProvider(
                    provider.id,
                    ClientCustomProviderPatch(enabled = enabled),
                )
            },
            revert = { show(provider.copy(enabled = previous)) },
            onError = { error = it },
        )
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

    fun check() = check.run()

    private fun setModels(models: List<ClientModel>) {
        val previous = custom.models
        viewModelScope.runOptimistic(
            apply = { show(provider.copy(source = custom.copy(models = models))) },
            commit = {
                client.updateCustomProvider(provider.id, ClientCustomProviderPatch(models = models))
            },
            revert = { show(provider.copy(source = custom.copy(models = previous))) },
            onError = { error = it },
        )
    }

    private fun show(changed: ClientProvider) {
        provider = changed
        onChange(changed)
    }

    private fun connectionPatch(): ClientCustomProviderPatch =
        ClientCustomProviderPatch(
            apiKey = apiKey.trim().takeIf { it != provider.apiKey },
            baseUrl = baseUrl.trim().takeIf { it != custom.baseUrl },
            apiPath = apiPath.trim().takeIf { it != custom.apiPath },
        )

    private fun draftName(): String? = nameDraft?.let { it.trim().ifEmpty { custom.identifier } }
}
