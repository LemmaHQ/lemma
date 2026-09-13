package com.lemmaos.lemma.data

import com.lemmaos.lemma.db.createDriver
import com.lemmaos.lemma.rpc.ApiClients
import com.lemmaos.lemma.rpc.AuthRepositoryImpl
import com.lemmaos.lemma.rpc.CacheStore
import com.lemmaos.lemma.rpc.ChatRepositoryImpl
import com.lemmaos.lemma.rpc.ConversationRepositoryImpl
import com.lemmaos.lemma.data.ProviderRepository
import com.lemmaos.lemma.rpc.ProviderRepositoryImpl
import com.lemmaos.lemma.rpc.SyncEngine

class AppContainerImpl(
    serverConfig: ServerConfigStore,
    session: SessionStore,
    userId: String,
) : AppContainer {
    private val cache = CacheStore(createDriver(userId))

    private val clients = ApiClients(
        checkNotNull(serverConfig.serverUrl) { "server URL not configured" },
        session,
    )

    private val syncEngine = SyncEngine(clients, cache, session)

    override val authRepository: AuthRepository = AuthRepositoryImpl(clients, session)
    override val conversationRepository: ConversationRepository =
        ConversationRepositoryImpl(clients, session, cache)
    override val providerRepository: ProviderRepository = ProviderRepositoryImpl(clients, session)
    override val chatRepository: ChatRepository = ChatRepositoryImpl(clients, session, cache)

    override fun startSync() {
        syncEngine.start()
    }

    override fun stopSync() {
        syncEngine.stop()
    }
}

actual fun createAppContainer(
    serverConfig: ServerConfigStore,
    session: SessionStore,
    userId: String,
): AppContainer = AppContainerImpl(serverConfig, session, userId)
