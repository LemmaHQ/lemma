package dev.lemmahq.lemma.data

import dev.lemmahq.lemma.db.Cached_messages
import dev.lemmahq.lemma.db.LemmaDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class LocalMessageRepository(database: LemmaDatabase) {

    private val queries = database.lemmaDatabaseQueries

    suspend fun getMessages(sessionId: String): List<Cached_messages> =
        withContext(Dispatchers.Default) {
            queries.selectMessagesBySession(sessionId).executeAsList()
        }

    suspend fun saveMessage(
        id: String,
        sessionId: String,
        role: Long,
        content: String,
        createdAt: Long,
    ) {
        withContext(Dispatchers.Default) {
            queries.insertOrReplaceMessage(id, sessionId, role, content, createdAt)
        }
    }
}
