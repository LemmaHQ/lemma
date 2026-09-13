package com.lemmaos.lemma.data

import com.lemmaos.lemma.domain.User
import kotlinx.coroutines.flow.StateFlow

interface AuthRepository {
    val user: StateFlow<User?>

    suspend fun bootstrap()

    suspend fun login(identifier: String, password: String)

    suspend fun signUp(username: String, email: String, password: String)

    suspend fun logout()
}

expect fun createAuthRepository(serverConfig: ServerConfigStore, session: SessionStore): AuthRepository
