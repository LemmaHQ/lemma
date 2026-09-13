package com.lemmaos.lemma.domain

data class ChatMessage(
    val id: String,
    val role: String,
    val content: String,
    val status: MessageStatusKind,
    val providerId: String,
    val model: String,
    val error: String? = null,
)

enum class MessageStatusKind {
    STREAMING,
    DONE,
    ABORTED,
    ERROR,
}
