package com.lemmaos.lemma.ui.chat

import com.lemmaos.lemma.data.ChatState
import com.lemmaos.lemma.domain.ChatMessage

data class ChatUiState(
    val conversationId: String? = null,
    val items: List<ChatMessage> = emptyList(),
    val streaming: Boolean = false,
    val hasMore: Boolean = false,
    val error: String? = null,
)

fun ChatState.toUiState() = ChatUiState(
    conversationId = conversationId,
    items = items,
    streaming = streaming,
    hasMore = hasMore,
    error = error,
)
