package dev.lemmahq.lemma.data

import dev.lemmahq.lemma.client.ClientMessage
import dev.lemmahq.lemma.db.LemmaDatabase
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json

/**
 * The messages sessions have shown, each kept whole in [database] as JSON; queries run on
 * [dispatcher].
 */
class LocalMessageRepository(
    database: LemmaDatabase,
    private val dispatcher: CoroutineDispatcher = Dispatchers.Default,
) {

    private val queries = database.lemmaDatabaseQueries

    /** The cached messages of session [sessionId], oldest first. */
    suspend fun getMessages(sessionId: String): List<ClientMessage> =
        withContext(dispatcher) {
            queries.selectMessageBodies(sessionId).executeAsList().map {
                Json.decodeFromString<ClientMessage>(it)
            }
        }

    /** Replaces the cached messages of session [sessionId] with [messages], oldest first. */
    suspend fun replaceMessages(sessionId: String, messages: List<ClientMessage>) {
        withContext(dispatcher) {
            queries.transaction {
                queries.deleteSessionMessages(sessionId)
                messages.forEachIndexed { position, message ->
                    queries.insertMessage(
                        sessionId,
                        position.toLong(),
                        Json.encodeToString(message),
                    )
                }
            }
        }
    }

    suspend fun deleteMessages(sessionId: String) {
        withContext(dispatcher) { queries.deleteSessionMessages(sessionId) }
    }

    suspend fun clear() {
        withContext(dispatcher) { queries.deleteAllMessages() }
    }
}
