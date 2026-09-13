package com.lemmaos.lemma.data

import com.lemmaos.lemma.domain.Conversation
import kotlinx.coroutines.flow.StateFlow

interface ConversationRepository {
    val list: StateFlow<List<Conversation>>
    val archived: StateFlow<List<Conversation>>

    suspend fun refresh()

    suspend fun create(): String

    suspend fun rename(id: String, title: String)

    suspend fun archive(id: String)

    suspend fun restore(id: String)

    suspend fun deleteArchived(id: String)
}

expect fun createConversationRepository(
    serverConfig: ServerConfigStore,
    session: SessionStore,
): ConversationRepository
