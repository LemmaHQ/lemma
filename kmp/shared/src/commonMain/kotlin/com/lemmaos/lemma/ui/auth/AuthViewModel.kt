package com.lemmaos.lemma.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lemmaos.lemma.data.AuthRepository
import com.lemmaos.lemma.domain.User
import com.lemmaos.lemma.ui.errorText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
    val ready: Boolean = false,
    val user: User? = null,
    val busy: Boolean = false,
    val error: String? = null,
)

class AuthViewModel(private val repository: AuthRepository) : ViewModel() {

    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            repository.user.collect { user ->
                _state.value = _state.value.copy(user = user)
            }
        }
    }

    fun bootstrap() {
        if (_state.value.ready) return
        viewModelScope.launch {
            repository.bootstrap()
            _state.value = _state.value.copy(ready = true)
        }
    }

    fun login(identifier: String, password: String) {
        submit { repository.login(identifier, password) }
    }

    fun signUp(username: String, email: String, password: String) {
        submit { repository.signUp(username, email, password) }
    }

    fun logout() {
        viewModelScope.launch { repository.logout() }
    }

    private fun submit(block: suspend () -> Unit) {
        if (_state.value.busy) return
        _state.value = _state.value.copy(busy = true, error = null)
        viewModelScope.launch {
            try {
                block()
                _state.value = _state.value.copy(busy = false)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _state.value = _state.value.copy(busy = false, error = errorText(e))
            }
        }
    }
}
