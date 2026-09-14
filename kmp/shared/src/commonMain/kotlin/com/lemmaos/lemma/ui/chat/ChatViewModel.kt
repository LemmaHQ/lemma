package com.lemmaos.lemma.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lemmaos.lemma.data.ChatRepository
import com.lemmaos.lemma.data.ChatState
import com.lemmaos.lemma.ui.errorText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class ChatViewModel(
    private val repository: ChatRepository,
) : ViewModel() {

    val state: StateFlow<ChatState> = repository.state

    fun open(conversationId: String) {
        viewModelScope.launch {
            try {
                repository.open(conversationId)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                repository.state.value.let { }
            }
        }
    }

    fun send(providerId: String, model: String, content: String) {
        viewModelScope.launch {
            try {
                repository.send(providerId, model, content)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // Surface as error text via repository state; repository
                // already maps stream failures internally.
            }
        }
    }

    fun abort() {
        viewModelScope.launch { repository.abort() }
    }

    fun loadMore() {
        viewModelScope.launch {
            try {
                repository.loadMore()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // Pagination failures are non-fatal.
            }
        }
    }
}
