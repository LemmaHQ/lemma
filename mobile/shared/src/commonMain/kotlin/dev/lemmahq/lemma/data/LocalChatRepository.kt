package dev.lemmahq.lemma.data

import dev.lemmahq.lemma.db.Cached_conversation
import dev.lemmahq.lemma.db.Cached_message
import dev.lemmahq.lemma.db.LemmaDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

interface LocalChatRepository {
    suspend fun getCursor(): Long
    suspend fun setCursor(cursor: Long)
    suspend fun getConversations(): List<Cached_conversation>
    suspend fun saveConversation(id: String, title: String, status: Long, createdAt: Long, updatedAt: Long, syncSeq: Long = 0L)
    suspend fun deleteConversation(id: String)
    suspend fun pruneConversationsNotIn(activeIds: Collection<String>)
    suspend fun getMessages(conversationId: String): List<Cached_message>
    suspend fun saveMessage(id: String, conversationId: String, role: Long, content: String, status: Long, createdAt: Long, updatedAt: Long, syncSeq: Long = 0L)
}

class SqlDelightLocalChatRepository(
    private val database: LemmaDatabase
) : LocalChatRepository {

    private val queries = database.lemmaDatabaseQueries

    override suspend fun getCursor(): Long = withContext(Dispatchers.Default) {
        queries.getCursor().executeAsOneOrNull() ?: 0L
    }

    override suspend fun setCursor(cursor: Long) = withContext(Dispatchers.Default) {
        queries.setCursor(cursor)
    }

    override suspend fun getConversations(): List<Cached_conversation> = withContext(Dispatchers.Default) {
        queries.selectAllConversations().executeAsList()
    }

    override suspend fun saveConversation(
        id: String,
        title: String,
        status: Long,
        createdAt: Long,
        updatedAt: Long,
        syncSeq: Long
    ) = withContext(Dispatchers.Default) {
        queries.insertOrReplaceConversation(id, title, status, createdAt, updatedAt, syncSeq)
    }

    override suspend fun deleteConversation(id: String) = withContext(Dispatchers.Default) {
        queries.deleteMessagesByConversation(id)
        queries.deleteConversation(id)
    }

    override suspend fun pruneConversationsNotIn(activeIds: Collection<String>) = withContext(Dispatchers.Default) {
        if (activeIds.isNotEmpty()) {
            queries.pruneMessagesNotIn(activeIds)
            queries.pruneConversationsNotIn(activeIds)
        }
    }

    override suspend fun getMessages(conversationId: String): List<Cached_message> = withContext(Dispatchers.Default) {
        queries.selectMessagesByConversation(conversationId).executeAsList()
    }

    override suspend fun saveMessage(
        id: String,
        conversationId: String,
        role: Long,
        content: String,
        status: Long,
        createdAt: Long,
        updatedAt: Long,
        syncSeq: Long
    ) = withContext(Dispatchers.Default) {
        queries.insertOrReplaceMessage(id, conversationId, role, content, status, createdAt, updatedAt, syncSeq)
    }
}
