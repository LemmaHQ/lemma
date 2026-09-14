package com.lemmaos.lemma.ui.providers

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lemmaos.lemma.data.FetchModelsRequest
import com.lemmaos.lemma.data.NewProvider
import com.lemmaos.lemma.data.ProviderPatch
import com.lemmaos.lemma.data.ProviderRepository
import com.lemmaos.lemma.domain.Provider
import com.lemmaos.lemma.ui.errorText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ProvidersUiState(
    val busy: Boolean = false,
    val error: String? = null,
)

class ProvidersViewModel(
    private val repository: ProviderRepository,
) : ViewModel() {

    val list: StateFlow<List<Provider>> = repository.list

    private val _uiState = MutableStateFlow(ProvidersUiState())
    val uiState: StateFlow<ProvidersUiState> = _uiState.asStateFlow()

    fun refresh() = submit { repository.refresh() }

    fun create(input: NewProvider, onCreated: () -> Unit) = submit {
        repository.create(input)
        onCreated()
    }

    fun update(id: String, patch: ProviderPatch) = submit { repository.update(id, patch) }

    fun remove(id: String) = submit { repository.remove(id) }

    fun fetchModels(
        id: String?,
        kind: Int?,
        baseUrl: String?,
        apiKey: String?,
        modelsPath: String?,
        onResult: (List<String>) -> Unit,
    ) = submit {
        val models = repository.fetchModels(
            FetchModelsRequest(id, kind, baseUrl, apiKey, modelsPath),
        )
        onResult(models)
    }

    private fun submit(block: suspend () -> Unit) {
        if (_uiState.value.busy) return
        _uiState.value = _uiState.value.copy(busy = true, error = null)
        viewModelScope.launch {
            try {
                block()
                _uiState.value = _uiState.value.copy(busy = false)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(busy = false, error = errorText(e))
            }
        }
    }
}
