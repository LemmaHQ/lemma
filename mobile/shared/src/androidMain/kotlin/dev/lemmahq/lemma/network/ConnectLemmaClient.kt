package dev.lemmahq.lemma.network

import com.connectrpc.ConnectException
import com.connectrpc.ResponseMessage
import dev.lemmahq.gen.lemma.v1.AgentEvent
import dev.lemmahq.gen.lemma.v1.AuthTokens
import dev.lemmahq.gen.lemma.v1.abortMessageRequest
import dev.lemmahq.gen.lemma.v1.checkAccountRequest
import dev.lemmahq.gen.lemma.v1.checkProviderRequest
import dev.lemmahq.gen.lemma.v1.createProviderRequest
import dev.lemmahq.gen.lemma.v1.createSessionRequest
import dev.lemmahq.gen.lemma.v1.deleteProviderRequest
import dev.lemmahq.gen.lemma.v1.deleteSessionRequest
import dev.lemmahq.gen.lemma.v1.fetchModelsRequest
import dev.lemmahq.gen.lemma.v1.getVersionRequest
import dev.lemmahq.gen.lemma.v1.listMessagesRequest
import dev.lemmahq.gen.lemma.v1.listProvidersRequest
import dev.lemmahq.gen.lemma.v1.listSessionsRequest
import dev.lemmahq.gen.lemma.v1.meRequest
import dev.lemmahq.gen.lemma.v1.providerModelsPatch
import dev.lemmahq.gen.lemma.v1.renameSessionRequest
import dev.lemmahq.gen.lemma.v1.resumeStreamRequest
import dev.lemmahq.gen.lemma.v1.sendMessageRequest
import dev.lemmahq.gen.lemma.v1.signInRequest
import dev.lemmahq.gen.lemma.v1.signOutRequest
import dev.lemmahq.gen.lemma.v1.signUpRequest
import dev.lemmahq.gen.lemma.v1.updateProviderRequest
import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.ClientMessagePage
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.ClientProviderInput
import dev.lemmahq.lemma.client.ClientProviderPatch
import dev.lemmahq.lemma.client.ClientSession
import dev.lemmahq.lemma.client.ClientUser
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.data.SettingsRepository
import kotlinx.coroutines.channels.ReceiveChannel
import kotlinx.coroutines.channels.consumeEach
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.FlowCollector
import kotlinx.coroutines.flow.flow

/**
 * [LemmaClient] over the Connect clients of [rpc]; signing in or up stores the tokens in
 * [settings].
 */
class ConnectLemmaClient(
    private val rpc: LemmaRpcClient,
    private val settings: SettingsRepository,
) : LemmaClient {

    override suspend fun getVersion(): String = call {
        rpc.system.getVersion(getVersionRequest {}, emptyMap())
    }
        .version

    override suspend fun checkAccount(identifier: String): Boolean = call {
        rpc.auth.checkAccount(
            checkAccountRequest { this.identifier = identifier.trim() },
            emptyMap(),
        )
    }
        .exists

    override suspend fun signIn(identifier: String, password: String) {
        val request = signInRequest {
            this.identifier = identifier.trim()
            this.password = password
        }
        storeTokens(call { rpc.auth.signIn(request, emptyMap()) }.tokens)
    }

    override suspend fun signUp(username: String, email: String, password: String) {
        val request = signUpRequest {
            this.username = username.trim()
            this.email = email.trim()
            this.password = password
        }
        storeTokens(call { rpc.auth.signUp(request, emptyMap()) }.tokens)
    }

    override suspend fun signOut() {
        val refreshToken = settings.getRefreshToken()
        settings.clearAuth()
        refreshToken ?: return
        call {
            rpc.auth.signOut(signOutRequest { this.refreshToken = refreshToken }, emptyMap())
        }
    }

    override suspend fun me(): ClientUser = call {
        rpc.auth.me(meRequest {}, emptyMap())
    }
        .user
        .toClient()

    override suspend fun listSessions(): List<ClientSession> = call {
        rpc.session.listSessions(listSessionsRequest {}, emptyMap())
    }
        .sessionsList
        .map { it.toClient() }

    override suspend fun renameSession(id: String, title: String): ClientSession = call {
        rpc.session.renameSession(
            renameSessionRequest {
                this.id = id
                this.title = title
            },
            emptyMap(),
        )
    }
        .session
        .toClient()

    override suspend fun deleteSession(id: String) {
        call { rpc.session.deleteSession(deleteSessionRequest { this.id = id }, emptyMap()) }
    }

    override suspend fun listProviders(): List<ClientProvider> = call {
        rpc.provider.listProviders(listProvidersRequest {}, emptyMap())
    }
        .providersList
        .map { it.toClient() }

    override suspend fun createProvider(input: ClientProviderInput): ClientProvider {
        val request = createProviderRequest {
            kind = providerKind(input.kind)
            name = input.name
            baseUrl = input.baseUrl
            apiKey = input.apiKey
            apiPath = input.apiPath
            modelsPath = input.modelsPath
            models.addAll(input.models)
            identifier = input.identifier
        }
        return call { rpc.provider.createProvider(request, emptyMap()) }.provider.toClient()
    }

    override suspend fun updateProvider(id: String, patch: ClientProviderPatch): ClientProvider {
        val request = updateProviderRequest {
            this.id = id
            patch.name?.let { name = it }
            patch.baseUrl?.let { baseUrl = it }
            patch.apiKey?.let { apiKey = it }
            patch.apiPath?.let { apiPath = it }
            patch.modelsPath?.let { modelsPath = it }
            patch.enabled?.let { enabled = it }
            patch.models?.let { models = providerModelsPatch { this.models.addAll(it) } }
        }
        return call { rpc.provider.updateProvider(request, emptyMap()) }.provider.toClient()
    }

    override suspend fun deleteProvider(id: String) {
        call { rpc.provider.deleteProvider(deleteProviderRequest { this.id = id }, emptyMap()) }
    }

    override suspend fun fetchProviderModels(id: String): List<String> = call {
        rpc.provider.fetchModels(fetchModelsRequest { this.id = id }, emptyMap())
    }
        .modelsList

    override suspend fun fetchModels(
        kind: String,
        baseUrl: String,
        apiKey: String,
        modelsPath: String,
    ): List<String> {
        val request = fetchModelsRequest {
            this.kind = providerKind(kind)
            this.baseUrl = baseUrl
            this.apiKey = apiKey
            this.modelsPath = modelsPath
        }
        return call { rpc.provider.fetchModels(request, emptyMap()) }.modelsList
    }

    override suspend fun checkProvider(
        id: String?,
        connection: ClientProviderInput,
        model: String,
    ): String {
        val request = checkProviderRequest {
            this.model = model
            if (id != null) {
                this.id = id
            } else {
                kind = providerKind(connection.kind)
                baseUrl = connection.baseUrl
                apiKey = connection.apiKey
                apiPath = connection.apiPath
            }
        }
        return call { rpc.provider.checkProvider(request, emptyMap()) }.error
    }

    override suspend fun createSession(): ClientSession = call {
        rpc.session.createSession(createSessionRequest {}, emptyMap())
    }
        .session
        .toClient()

    override suspend fun listMessages(
        sessionId: String,
        beforeId: String?,
        limit: Int,
    ): ClientMessagePage {
        val request = listMessagesRequest {
            this.sessionId = sessionId
            beforeId?.let { this.beforeId = it }
            this.limit = limit
        }
        val response = call { rpc.session.listMessages(request, emptyMap()) }
        return ClientMessagePage(
            messages = response.messagesList.map { it.toClient() },
            hasMore = response.hasMore,
        )
    }

    override fun sendMessage(
        sessionId: String,
        content: String,
        providerId: String,
        model: String,
    ): Flow<AgentStreamEvent> = flow {
        val stream = rpc.agent.sendMessage(emptyMap())
        stream.sendAndClose(
            sendMessageRequest {
                this.sessionId = sessionId
                this.content = content
                this.providerId = providerId
                this.model = model
            }
        )
        emitEvents(stream.responseChannel()) { it.event }
    }

    override fun resumeStream(messageId: String, offset: Long): Flow<AgentStreamEvent> = flow {
        val stream = rpc.agent.resumeStream(emptyMap())
        stream.sendAndClose(
            resumeStreamRequest {
                this.messageId = messageId
                this.offset = offset
            }
        )
        emitEvents(stream.responseChannel()) { it.event }
    }

    override suspend fun abortMessage(messageId: String) {
        call {
            rpc.agent.abortMessage(abortMessageRequest { this.messageId = messageId }, emptyMap())
        }
    }

    private fun storeTokens(tokens: AuthTokens) {
        settings.setTokens(tokens.accessToken, tokens.refreshToken)
    }
}

private suspend fun <T> FlowCollector<AgentStreamEvent>.emitEvents(
    responses: ReceiveChannel<T>,
    event: (T) -> AgentEvent,
) {
    try {
        responses.consumeEach { emit(event(it).toStreamEvent()) }
    } catch (e: ConnectException) {
        throw e.toServiceException()
    }
}

private suspend fun <T> call(request: suspend () -> ResponseMessage<T>): T =
    when (val response = request()) {
        is ResponseMessage.Success -> response.message
        is ResponseMessage.Failure -> throw response.cause.toServiceException()
    }
