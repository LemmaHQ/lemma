package dev.lemmahq.lemma.engine

import android.content.Context
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.uniffi.AgentEventListener
import dev.lemmahq.lemma.uniffi.LemmaEngine
import dev.lemmahq.lemma.uniffi.MobileAgentEvent
import java.security.SecureRandom
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Owns the process-lifetime embedded Rust engine used by local mode. */
class LocalEngine private constructor() {

    companion object {
        private const val SECRET_BYTES = 32

        private val mutex = Mutex()
        private var engine: LemmaEngine? = null

        /** Returns the running engine, opening and migrating the local database on first use. */
        suspend fun get(context: Context, settings: SettingsRepository): LemmaEngine {
            engine?.let {
                return it
            }
            return mutex.withLock {
                engine
                    ?: LemmaEngine.open(
                            dataDir = context.filesDir.absolutePath,
                            jwtSecret = localJwtSecret(settings),
                        )
                        .also { engine = it }
            }
        }

        private fun localJwtSecret(settings: SettingsRepository): String {
            settings.getLocalJwtSecret()?.let {
                return it
            }
            val bytes = ByteArray(SECRET_BYTES).also { SecureRandom().nextBytes(it) }
            val secret = bytes.joinToString(separator = "") { byte -> "%02x".format(byte) }
            settings.setLocalJwtSecret(secret)
            return secret
        }
    }
}

/**
 * Runs one agent turn locally, streaming events until `Done`, `Aborted`, or `Error`, then
 * completing.
 */
fun LemmaEngine.sendMessageEvents(
    userId: String,
    conversationId: String,
    content: String,
    providerId: String,
    model: String,
    thinkingEffort: String? = null,
): Flow<MobileAgentEvent> = callbackFlow {
    val listener =
        object : AgentEventListener {
            override fun onEvent(event: MobileAgentEvent) {
                trySend(event)
            }
        }
    sendMessage(userId, conversationId, content, providerId, model, thinkingEffort, listener)
    close()
    awaitClose()
}
