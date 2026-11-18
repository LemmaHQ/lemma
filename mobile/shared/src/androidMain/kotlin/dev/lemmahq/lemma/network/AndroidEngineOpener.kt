package dev.lemmahq.lemma.network

import dev.lemmahq.lemma.client.EngineOpener
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.engine.ENGINE_BASE_URL
import dev.lemmahq.lemma.engine.Engine
import dev.lemmahq.lemma.uniffi.EngineException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Opens clients of the in-process engine over [dataDir]; the engine opens once per opener, so the
 * app holds one opener for its process.
 */
class AndroidEngineOpener(private val dataDir: String) : EngineOpener {
    private val mutex = Mutex()
    private var engine: Engine? = null

    override suspend fun open(): LemmaClient =
        ConnectLemmaClient(LemmaRpcClient(ENGINE_BASE_URL, engine().transport))

    private suspend fun engine(): Engine = mutex.withLock {
        engine
            ?: try {
                    Engine.open(dataDir)
                } catch (e: EngineException) {
                    throw ServiceException(ServiceFailure.Unspecified, e)
                }
                .also { engine = it }
    }
}
