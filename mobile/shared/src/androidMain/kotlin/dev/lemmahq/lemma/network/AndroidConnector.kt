package dev.lemmahq.lemma.network

import dev.lemmahq.lemma.client.Connection
import dev.lemmahq.lemma.client.Connector
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.engine.ENGINE_BASE_URL
import dev.lemmahq.lemma.engine.LocalEngine
import dev.lemmahq.lemma.uniffi.EngineException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Opens clients of a server over the network, or of the in-process engine over [dataDir]; the
 * engine opens once per connector, so the app holds one connector for its process.
 */
class AndroidConnector(private val dataDir: String, private val settings: SettingsRepository) :
    Connector {
    private val mutex = Mutex()
    private var engine: LocalEngine? = null

    override val localAvailable = true

    override suspend fun open(connection: Connection): LemmaClient {
        val rpc =
            when (connection) {
                is Connection.Remote -> LemmaRpcClient(connection.serverUrl, settings)
                Connection.Local -> LemmaRpcClient(ENGINE_BASE_URL, settings, engine().transport)
            }
        return ConnectLemmaClient(rpc, settings)
    }

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
