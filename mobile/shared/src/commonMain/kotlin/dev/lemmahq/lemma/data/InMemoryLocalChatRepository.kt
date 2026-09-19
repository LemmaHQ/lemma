package dev.lemmahq.lemma.data

import dev.lemmahq.lemma.db.Cached_conversation
import dev.lemmahq.lemma.db.Cached_message

class InMemoryLocalChatRepository : LocalChatRepository {
    private var cursor: Long = 0L
    private val conversations = mutableListOf<Cached_conversation>()
    private val messages = mutableListOf<Cached_message>()

    override suspend fun getCursor(): Long = cursor

    override suspend fun setCursor(cursor: Long) {
        this.cursor = cursor
    }

    override suspend fun getConversations(): List<Cached_conversation> {
        return conversations.sortedByDescending { it.updated_at }
    }

    override suspend fun saveConversation(id: String, title: String, status: Long, createdAt: Long, updatedAt: Long, syncSeq: Long) {
        conversations.removeAll { it.id == id }
        conversations.add(Cached_conversation(id, title, status, createdAt, updatedAt, syncSeq))
    }

    override suspend fun deleteConversation(id: String) {
        conversations.removeAll { it.id == id }
        messages.removeAll { it.conversation_id == id }
    }

    override suspend fun pruneConversationsNotIn(activeIds: Collection<String>) {
        conversations.removeAll { it.id !in activeIds }
        messages.removeAll { it.conversation_id !in activeIds }
    }

    override suspend fun getMessages(conversationId: String): List<Cached_message> {
        return messages.filter { it.conversation_id == conversationId }.sortedBy { it.created_at }
    }

    override suspend fun saveMessage(id: String, conversationId: String, role: Long, content: String, status: Long, createdAt: Long, updatedAt: Long, syncSeq: Long) {
        messages.removeAll { it.id == id }
        messages.add(Cached_message(id, conversationId, role, content, status, createdAt, updatedAt, syncSeq))
    }
}
