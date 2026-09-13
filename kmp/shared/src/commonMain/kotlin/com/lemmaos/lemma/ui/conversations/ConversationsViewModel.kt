package com.lemmaos.lemma.ui.conversations

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lemmaos.lemma.data.ConversationRepository
import com.lemmaos.lemma.domain.Conversation
import com.lemmaos.lemma.lib.GroupKey
import com.lemmaos.lemma.lib.SessionGroup
import com.lemmaos.lemma.lib.groupSessions
import com.lemmaos.lemma.ui.errorText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class ConversationsUiState(
    val busy: Boolean = false,
    val error: String? = null,
)

class ConversationsViewModel(
    private val repository: ConversationRepository,
) : ViewModel() {

    val list: StateFlow<List<Conversation>> = repository.list

    val archived: StateFlow<List<Conversation>> = repository.archived

    val groups: StateFlow<List<SessionGroup>> = list
        .map { sessions: List<Conversation> -> groupSessions(sessions, System.currentTimeMillis()) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _uiState = MutableStateFlow(ConversationsUiState())
    val uiState: StateFlow<ConversationsUiState> = _uiState.asStateFlow()

    fun refresh() = submit { repository.refresh() }

    fun create(onCreated: (String) -> Unit) = submit {
        onCreated(repository.create())
    }

    fun rename(id: String, title: String) = submit { repository.rename(id, title) }

    fun archive(id: String) = submit { repository.archive(id) }

    fun restore(id: String) = submit { repository.restore(id) }

    fun deleteArchived(id: String) = submit { repository.deleteArchived(id) }

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

fun groupKeyLabel(key: GroupKey): String = when (key) {
    GroupKey.TODAY -> "Today"
    GroupKey.YESTERDAY -> "Yesterday"
    GroupKey.LAST_7_DAYS -> "Last 7 days"
    GroupKey.EARLIER -> "Earlier"
}
