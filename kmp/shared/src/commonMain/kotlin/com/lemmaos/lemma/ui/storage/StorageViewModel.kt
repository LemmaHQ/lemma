package com.lemmaos.lemma.ui.storage

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lemmaos.lemma.data.StoragePatch
import com.lemmaos.lemma.data.StorageRepository
import com.lemmaos.lemma.domain.StorageConfig
import com.lemmaos.lemma.ui.errorText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class StorageUiState(
    val loaded: Boolean = false,
    val busy: Boolean = false,
    val migrating: Boolean = false,
    val error: String? = null,
    val testMessage: String? = null,
)

class StorageViewModel(
    private val repository: StorageRepository,
) : ViewModel() {

    val config: StateFlow<StorageConfig?> = repository.config
    val migrationProgress = repository.migrationProgress

    private val _uiState = MutableStateFlow(StorageUiState())
    val uiState: StateFlow<StorageUiState> = _uiState.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            try {
                repository.refresh()
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
            } finally {
                _uiState.value = _uiState.value.copy(loaded = true)
            }
        }
    }

    fun save(patch: StoragePatch) {
        submit {
            val migrationTotal = repository.save(patch)
            if (migrationTotal > 0) {
                repository.runMigration()
            }
        }
    }

    fun test(patch: StoragePatch) {
        submit {
            val message = repository.test(patch)
            _uiState.value = _uiState.value.copy(testMessage = message)
        }
    }

    fun delete() {
        submit { repository.delete() }
    }

    fun migrate() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(migrating = true, error = null)
            try {
                repository.runMigration()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = errorText(e))
            } finally {
                _uiState.value = _uiState.value.copy(migrating = false)
            }
        }
    }

    private fun submit(block: suspend () -> Unit) {
        if (_uiState.value.busy) return
        _uiState.value = _uiState.value.copy(busy = true, error = null, testMessage = null)
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
