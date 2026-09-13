package com.lemmaos.lemma.data

import com.lemmaos.lemma.rpc.ApiClients
import com.lemmaos.lemma.rpc.ChatRepositoryImpl

actual fun createChatRepository(
    serverConfig: ServerConfigStore,
    session: SessionStore,
): ChatRepository {
    val serverUrl = checkNotNull(serverConfig.serverUrl) { "server URL not configured" }
    return ChatRepositoryImpl(ApiClients(serverUrl, session), session)
}
