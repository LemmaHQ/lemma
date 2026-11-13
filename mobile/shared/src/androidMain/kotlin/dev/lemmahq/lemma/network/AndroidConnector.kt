package dev.lemmahq.lemma.network

import dev.lemmahq.lemma.client.Connector
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.engine.ENGINE_BASE_URL
import dev.lemmahq.lemma.engine.LocalEngine
import dev.lemmahq.lemma.uniffi.EngineException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Opens clients of the in-process engine over [dataDir]; the engine opens once per connector, so
 * the app holds one connector for its process.
 */
class AndroidConnector(private val dataDir: String) : Connector {
    private val mutex = Mutex()
    private var engine: LocalEngine? = null

    override suspend fun open(): LemmaClient =
        ConnectLemmaClient(LemmaRpcClient(ENGINE_BASE_URL, engine().transport))

    private suspend fun engine(): LocalEngine = mutex.withLock {
        engine
            ?: try {
                    LocalEngine.open(dataDir)
                } catch (e: EngineException) {
                    throw ServiceException(ServiceFailure.Unspecified, e)
                }
                .also { engine = it }
    }
}
