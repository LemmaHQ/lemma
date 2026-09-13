package com.lemmaos.lemma.rpc

import com.lemmaos.gen.lemma.v1.archiveConversationRequest
import com.lemmaos.gen.lemma.v1.createConversationRequest
import com.lemmaos.gen.lemma.v1.deleteArchivedRequest
import com.lemmaos.gen.lemma.v1.listArchivedRequest
import com.lemmaos.gen.lemma.v1.listConversationsRequest
import com.lemmaos.gen.lemma.v1.renameConversationRequest
import com.lemmaos.gen.lemma.v1.restoreConversationRequest
import com.lemmaos.lemma.data.ConversationRepository
import com.lemmaos.lemma.data.SessionStore
import com.lemmaos.lemma.domain.Conversation
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class ConversationRepositoryImpl(
    private val clients: ApiClients,
    private val session: SessionStore,
    private val cache: CacheStore? = null,
) : ConversationRepository {

    private val _list = MutableStateFlow<List<Conversation>>(emptyList())
    override val list: StateFlow<List<Conversation>> = _list.asStateFlow()

    private val _archived = MutableStateFlow<List<Conversation>>(emptyList())
    override val archived: StateFlow<List<Conversation>> = _archived.asStateFlow()
    override suspend fun refresh() {
        // Cache first: render instantly, then converge with the server. On
        // failure the cached view still stands (offline-first).
        cache?.let {
            _list.value = it.conversations()
            _archived.value = it.archivedConversations()
        }
        try {
            _list.value = clients.conversations
                .listConversations(listConversationsRequest {}, emptyMap())
                .orThrowApp()
                .conversationsList
                .map { it.toDomain() }
            _archived.value = clients.conversations
                .listArchived(listArchivedRequest {}, emptyMap())
                .orThrowApp()
                .conversationsList
                .map { it.toDomain() }
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            // Offline: keep the cached view.
        }
    }


    override suspend fun create(): String {
        val conversation = clients.conversations
            .createConversation(createConversationRequest {}, emptyMap())
            .orThrowApp()
            .conversation
            .toDomain()
        _list.value = listOf(conversation) + _list.value
        return conversation.id
    }

    override suspend fun rename(id: String, title: String) {
        val conversation = clients.conversations
            .renameConversation(renameConversationRequest { this.id = id; this.title = title }, emptyMap())
            .orThrowApp()
            .conversation
            .toDomain()
        _list.value = _list.value.map { if (it.id == id) conversation else it }
    }

    override suspend fun archive(id: String) {
        val conversation = clients.conversations
            .archiveConversation(archiveConversationRequest { this.id = id }, emptyMap())
            .orThrowApp()
            .conversation
            .toDomain()
        _list.value = _list.value.filterNot { it.id == id }
        _archived.value = listOf(conversation) + _archived.value
    }

    override suspend fun restore(id: String) {
        val conversation = clients.conversations
            .restoreConversation(restoreConversationRequest { this.id = id }, emptyMap())
            .orThrowApp()
            .conversation
            .toDomain()
        _archived.value = _archived.value.filterNot { it.id == id }
        _list.value = listOf(conversation) + _list.value
    }

    override suspend fun deleteArchived(id: String) {
        clients.conversations
            .deleteArchived(deleteArchivedRequest { this.id = id }, emptyMap())
            .orThrowApp()
        _archived.value = _archived.value.filterNot { it.id == id }
    }
}
