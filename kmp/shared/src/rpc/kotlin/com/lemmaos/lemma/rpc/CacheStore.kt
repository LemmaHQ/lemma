package com.lemmaos.lemma.rpc

import app.cash.sqldelight.db.SqlDriver
import com.lemmaos.gen.lemma.v1.PullResponse
import com.lemmaos.lemma.db.LemmaDb
import com.lemmaos.lemma.domain.ChatMessage
import com.lemmaos.lemma.domain.Conversation
import com.lemmaos.lemma.domain.MessageStatusKind

class CacheStore(driver: SqlDriver) {

    private val database = LemmaDb(driver)

    fun cursor(): Long =
        database.metaQueries.getCursor().executeAsOneOrNull()?.toLongOrNull() ?: 0L

    fun setCursor(value: Long) {
        database.metaQueries.setCursor(value.toString())
    }

    fun messages(conversationId: String): List<ChatMessage> =
        database.messagesQueries.listMessages(conversationId).executeAsList().map { row ->
            ChatMessage(
                id = row.id,
                role = row.role,
                content = row.content,
                status = when (row.status) {
                    1L -> MessageStatusKind.STREAMING
                    3L -> MessageStatusKind.ABORTED
                    4L -> MessageStatusKind.ERROR
                    else -> MessageStatusKind.DONE
                },
                providerId = row.providerId,
                model = row.model,
            )
        }

    fun conversations(): List<Conversation> =
        database.conversationsQueries.listConversations().executeAsList().map { row ->
            Conversation(
                id = row.id,
                title = row.title,
                archived = row.status == 2L,
                messageCount = row.messageCount.toInt(),
                createdAtMs = row.createdAtMs,
                updatedAtMs = row.updatedAtMs,
                archivedAtMs = row.archivedAtMs,
            )
        }

    fun archivedConversations(): List<Conversation> =
        database.conversationsQueries.listArchived().executeAsList().map { row ->
            Conversation(
                id = row.id,
                title = row.title,
                archived = true,
                messageCount = row.messageCount.toInt(),
                createdAtMs = row.createdAtMs,
                updatedAtMs = row.updatedAtMs,
                archivedAtMs = row.archivedAtMs,
            )
        }


    fun applyPull(res: PullResponse) {
        database.transaction {
            for (entry in res.conversationsList) {
                val conversation = entry.conversation ?: continue
                database.conversationsQueries.upsertConversation(
                    id = conversation.id,
                    title = conversation.title,
                    status = conversation.status.number.toLong(),
                    archivedAtMs = if (conversation.hasArchivedAt()) conversation.archivedAt.toMs() else null,
                    messageCount = conversation.messageCount.toLong(),
                    createdAtMs = conversation.createdAt.toMs(),
                    updatedAtMs = conversation.updatedAt.toMs(),
                    syncSeq = entry.syncSeq,
                )
            }
            for (entry in res.messagesList) {
                val message = entry.message ?: continue
                database.messagesQueries.upsertMessage(
                    id = message.id,
                    conversationId = message.conversationId,
                    role = message.role,
                    content = message.content,
                    providerId = message.providerId,
                    model = message.model,
                    status = message.status.number.toLong(),
                    createdAtMs = message.createdAt.toMs(),
                    seq = message.seq,
                    syncSeq = entry.syncSeq,
                )
            }
            // Roster entries carry no per-entry syncSeq; stamping them with 0
            // lets the LWW check keep any newer row from the incremental feed.
            for (conversation in res.archivedList) {
                database.conversationsQueries.upsertConversation(
                    id = conversation.id,
                    title = conversation.title,
                    status = conversation.status.number.toLong(),
                    archivedAtMs = if (conversation.hasArchivedAt()) conversation.archivedAt.toMs() else null,
                    messageCount = conversation.messageCount.toLong(),
                    createdAtMs = conversation.createdAt.toMs(),
                    updatedAtMs = conversation.updatedAt.toMs(),
                    syncSeq = 0L,
                )
            }
            val activeIds = res.activeList.map { it.id }
            for (zombie in database.conversationsQueries
                .staleActiveIds(activeIds)
                .executeAsList()) {
                database.messagesQueries.deleteMessagesOf(zombie)
                database.conversationsQueries.deleteConversation(zombie)
            }
            val archivedIds = res.archivedList.map { it.id }
            for (removed in database.conversationsQueries
                .staleArchivedIds(archivedIds)
                .executeAsList()) {
                database.messagesQueries.deleteMessagesOf(removed)
                database.conversationsQueries.deleteConversation(removed)
            }
            for (id in archivedIds) {
                database.messagesQueries.deleteMessagesOf(id)
            }
        }
    }
}
