package com.lemmaos.lemma.data

import com.lemmaos.lemma.domain.ChatMessage
import kotlinx.coroutines.flow.StateFlow

interface ChatRepository {
    val state: StateFlow<ChatState>

    suspend fun open(conversationId: String)

    suspend fun loadMore()

    suspend fun send(providerId: String, model: String, content: String)

    suspend fun abort()
}

data class ChatState(
    val conversationId: String? = null,
    val items: List<ChatMessage> = emptyList(),
    val streaming: Boolean = false,
    val hasMore: Boolean = false,
    val error: String? = null,
)

expect fun createChatRepository(
    serverConfig: ServerConfigStore,
    session: SessionStore,
): ChatRepository
