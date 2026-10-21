package dev.lemmahq.lemma.data

import dev.lemmahq.lemma.db.Cached_message
import dev.lemmahq.lemma.db.LemmaDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class LocalChatRepository(database: LemmaDatabase) {

    private val queries = database.lemmaDatabaseQueries

    suspend fun getMessages(conversationId: String): List<Cached_message> =
        withContext(Dispatchers.Default) {
            queries.selectMessagesByConversation(conversationId).executeAsList()
        }

    suspend fun saveMessage(
        id: String,
        conversationId: String,
        role: Long,
        content: String,
        status: Long,
        createdAt: Long,
        updatedAt: Long,
    ) {
        withContext(Dispatchers.Default) {
            queries.insertOrReplaceMessage(
                id,
                conversationId,
                role,
                content,
                status,
                createdAt,
                updatedAt,
            )
        }
    }
}
