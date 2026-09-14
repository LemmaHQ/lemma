package com.lemmaos.lemma.rpc

import com.connectrpc.Code
import com.connectrpc.ConnectException
import com.lemmaos.gen.lemma.v1.Role
import com.lemmaos.gen.lemma.v1.loginRequest
import com.lemmaos.gen.lemma.v1.logoutRequest
import com.lemmaos.gen.lemma.v1.meRequest
import com.lemmaos.gen.lemma.v1.refreshRequest
import com.lemmaos.gen.lemma.v1.signUpRequest
import com.lemmaos.lemma.data.AuthRepository
import com.lemmaos.lemma.data.SessionStore
import com.lemmaos.lemma.domain.User
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class AuthRepositoryImpl(
    private val clients: ApiClients,
    private val session: SessionStore,
) : AuthRepository {

    private val _user = MutableStateFlow<User?>(null)
    override val user: StateFlow<User?> = _user.asStateFlow()

    override suspend fun bootstrap() {
        if (session.refreshToken == null) return
        try {
            refresh()
            _user.value = me()
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            session.clear()
            _user.value = null
        }
    }

    override suspend fun login(identifier: String, password: String) {
        val request = if ("@" in identifier) {
            loginRequest { email = identifier; this.password = password }
        } else {
            loginRequest { username = identifier; this.password = password }
        }
        val response = clients.auth.login(request, emptyMap()).orThrowApp()
        session.update(response.tokens.accessToken, response.tokens.refreshToken)
        _user.value = response.user.toDomain()
    }

    override suspend fun signUp(username: String, email: String, password: String) {
        val response = clients.auth.signUp(
            signUpRequest {
                this.username = username
                this.email = email
                this.password = password
            },
            emptyMap(),
        ).orThrowApp()
        session.update(response.tokens.accessToken, response.tokens.refreshToken)
        _user.value = response.user.toDomain()
    }

    override suspend fun logout() {
        try {
            val token = session.refreshToken
            if (token != null) {
                clients.auth.logout(logoutRequest { refreshToken = token }, emptyMap())
            }
        } catch (_: Exception) {
        } finally {
            session.clear()
            _user.value = null
        }
    }

    private suspend fun me(): User {
        return clients.auth.me(meRequest {}, emptyMap()).orThrowApp().user.toDomain()
    }

    private suspend fun refresh() {
        val token = session.refreshToken
            ?: throw ConnectException(Code.UNAUTHENTICATED)
        val response = clients.auth.refresh(
            refreshRequest { refreshToken = token },
            emptyMap(),
        ).orThrowApp()
        session.update(response.tokens.accessToken, response.tokens.refreshToken)
    }
}

private fun com.lemmaos.gen.lemma.v1.User.toDomain() = User(
    id = id,
    username = username,
    email = email,
    owner = role == Role.ROLE_OWNER,
)
