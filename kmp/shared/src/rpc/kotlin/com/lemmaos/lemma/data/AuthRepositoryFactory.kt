package com.lemmaos.lemma.data

import com.lemmaos.lemma.rpc.ApiClients
import com.lemmaos.lemma.rpc.AuthRepositoryImpl

actual fun createAuthRepository(serverConfig: ServerConfigStore, session: SessionStore): AuthRepository {
    val serverUrl = checkNotNull(serverConfig.serverUrl) { "server URL not configured" }
    return AuthRepositoryImpl(ApiClients(serverUrl, session), session)
}
