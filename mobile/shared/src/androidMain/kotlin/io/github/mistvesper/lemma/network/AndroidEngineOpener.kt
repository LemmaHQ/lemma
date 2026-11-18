package io.github.mistvesper.lemma.network

import io.github.mistvesper.lemma.client.EngineOpener
import io.github.mistvesper.lemma.client.LemmaClient
import io.github.mistvesper.lemma.client.ServiceException
import io.github.mistvesper.lemma.client.ServiceFailure
import io.github.mistvesper.lemma.engine.ENGINE_BASE_URL
import io.github.mistvesper.lemma.engine.Engine
import io.github.mistvesper.lemma.uniffi.EngineException
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
