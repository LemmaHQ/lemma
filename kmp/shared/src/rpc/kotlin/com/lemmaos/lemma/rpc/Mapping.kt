package com.lemmaos.lemma.rpc

import com.google.protobuf.Timestamp
import com.lemmaos.gen.lemma.v1.ConversationStatus
import com.lemmaos.lemma.domain.Conversation

fun Timestamp.toMs(): Long = seconds * 1000 + nanos / 1_000_000

fun com.lemmaos.gen.lemma.v1.Conversation.toDomain() = Conversation(
    id = id,
    title = title,
    archived = status == ConversationStatus.CONVERSATION_STATUS_ARCHIVED,
    messageCount = messageCount,
    createdAtMs = createdAt.toMs(),
    updatedAtMs = updatedAt.toMs(),
    archivedAtMs = if (hasArchivedAt()) archivedAt.toMs() else null,
)
