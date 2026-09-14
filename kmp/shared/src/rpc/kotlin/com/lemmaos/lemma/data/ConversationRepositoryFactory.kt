package com.lemmaos.lemma.data

import com.lemmaos.lemma.rpc.ApiClients
import com.lemmaos.lemma.rpc.ConversationRepositoryImpl

actual fun createConversationRepository(
    serverConfig: ServerConfigStore,
    session: SessionStore,
): ConversationRepository {
    val serverUrl = checkNotNull(serverConfig.serverUrl) { "server URL not configured" }
    return ConversationRepositoryImpl(ApiClients(serverUrl, session), session)
}
