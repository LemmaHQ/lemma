package dev.lemmahq.lemma.client

import com.connectrpc.ResponseMessage
import dev.lemmahq.gen.lemma.v1.abortMessageRequest
import dev.lemmahq.gen.lemma.v1.checkProviderRequest
import dev.lemmahq.gen.lemma.v1.createProviderRequest
import dev.lemmahq.gen.lemma.v1.createSessionRequest
import dev.lemmahq.gen.lemma.v1.deleteProviderRequest
import dev.lemmahq.gen.lemma.v1.fetchModelsRequest
import dev.lemmahq.gen.lemma.v1.listMessagesRequest
import dev.lemmahq.gen.lemma.v1.listProvidersRequest
import dev.lemmahq.gen.lemma.v1.providerModelsPatch
import dev.lemmahq.gen.lemma.v1.sendMessageRequest
import dev.lemmahq.gen.lemma.v1.signInRequest
import dev.lemmahq.gen.lemma.v1.signUpRequest
import dev.lemmahq.gen.lemma.v1.updateProviderRequest
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.network.LemmaRpcClient
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * The Lemma services over Connect, from a remote server or the local engine; the transport of
 * [LemmaRpcClient] decides which.
 */
class LemmaClient(
    private val rpc: LemmaRpcClient,
    private val settings: SettingsRepository,
) {

    /** Authenticates by username or email and persists the issued tokens. */
    suspend fun signIn(identifier: String, password: String) {
        val request = signInRequest {
            this.identifier = identifier.trim()
            this.password = password
        }
        when (val response = rpc.auth.signIn(request, emptyMap())) {
            is ResponseMessage.Success ->
                persistTokens(
                    response.message.tokens.accessToken,
                    response.message.tokens.refreshToken,
                )
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    /** Registers a new account and persists the issued tokens. */
    suspend fun signUp(username: String, email: String, password: String) {
        val request = signUpRequest {
            this.username = username.trim()
            this.email = email.trim()
            this.password = password
        }
        when (val response = rpc.auth.signUp(request, emptyMap())) {
            is ResponseMessage.Success ->
                persistTokens(
                    response.message.tokens.accessToken,
                    response.message.tokens.refreshToken,
                )
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    /** Lists provider configurations of the current account. */
    suspend fun listProviders(): List<ClientProvider> {
        return when (
            val response = rpc.provider.listProviders(listProvidersRequest {}, emptyMap())
        ) {
            is ResponseMessage.Success -> response.message.providersList.map { it.toClient() }
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    /** Creates a provider configuration and returns the stored record. */
    suspend fun createProvider(input: ClientProviderInput): ClientProvider {
        val request = createProviderRequest {
            kind = providerKindEnum(input.kind)
            name = input.name
            baseUrl = input.baseUrl
            apiKey = input.apiKey
            apiPath = input.apiPath
            modelsPath = input.modelsPath
            models.addAll(input.models)
            identifier = input.identifier
        }
        return when (val response = rpc.provider.createProvider(request, emptyMap())) {
            is ResponseMessage.Success -> response.message.provider.toClient()
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    /** Applies a patch to a provider and returns the stored record. */
    suspend fun updateProvider(id: String, patch: ClientProviderPatch): ClientProvider {
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
        return when (val response = rpc.provider.updateProvider(request, emptyMap())) {
            is ResponseMessage.Success -> response.message.provider.toClient()
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    /** Deletes a provider configuration. */
    suspend fun deleteProvider(id: String) {
        val request = deleteProviderRequest { this.id = id }
        when (val response = rpc.provider.deleteProvider(request, emptyMap())) {
            is ResponseMessage.Success -> Unit
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    /** Fetches the live model list using a stored provider's credentials. */
    suspend fun fetchProviderModels(id: String): List<String> {
        val request = fetchModelsRequest { this.id = id }
        return when (val response = rpc.provider.fetchModels(request, emptyMap())) {
            is ResponseMessage.Success -> response.message.modelsList
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    /** Fetches the live model list for ad-hoc connection details. */
    suspend fun fetchModels(
        kind: String,
        baseUrl: String,
        apiKey: String,
        modelsPath: String,
    ): List<String> {
        val request = fetchModelsRequest {
            this.kind = providerKindEnum(kind)
            this.baseUrl = baseUrl
            this.apiKey = apiKey
            this.modelsPath = modelsPath
        }
        return when (val response = rpc.provider.fetchModels(request, emptyMap())) {
            is ResponseMessage.Success -> response.message.modelsList
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    /**
     * Sends a test request for [model] through the stored provider [id], or through the ad-hoc
     * connection details when [id] is null; returns the upstream failure message, empty when the
     * model answered.
     */
    suspend fun checkProvider(id: String?, connection: ClientProviderInput, model: String): String {
        val request = checkProviderRequest {
            this.model = model
            if (id != null) {
                this.id = id
            } else {
                kind = providerKindEnum(connection.kind)
                baseUrl = connection.baseUrl
                apiKey = connection.apiKey
                apiPath = connection.apiPath
            }
        }
        return when (val response = rpc.provider.checkProvider(request, emptyMap())) {
            is ResponseMessage.Success -> response.message.error
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    /** Creates an empty session. */
    suspend fun createSession(): ClientSession {
        return when (
            val response = rpc.session.createSession(createSessionRequest {}, emptyMap())
        ) {
            is ResponseMessage.Success ->
                response.message.session.let {
                    ClientSession(id = it.id, title = it.title)
                }
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    /** Lists one newest-first page of a session's settled messages. */
    suspend fun listMessages(sessionId: String, beforeId: String? = null): ClientMessagePage {
        val request = listMessagesRequest {
            this.sessionId = sessionId
            beforeId?.let { this.beforeId = it }
        }
        return when (val response = rpc.session.listMessages(request, emptyMap())) {
            is ResponseMessage.Success ->
                ClientMessagePage(
                    messages =
                        response.message.messagesList.map {
                            ClientMessage(
                                id = it.id,
                                role = it.role,
                                content = it.content,
                                providerId = it.providerId.ifBlank { null },
                                model = it.model.ifBlank { null },
                                createdAtSeconds = it.createdAt.seconds,
                            )
                        },
                    hasMore = response.message.hasMore,
                )
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    /**
     * Streams one agent turn, terminating with [AgentStreamEvent.Done], [AgentStreamEvent.Aborted],
     * or [AgentStreamEvent.Error].
     */
    fun sendMessage(
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
        for (response in stream.responseChannel()) {
            val event = response.event
            when {
                event.hasDelta() && event.delta.hasText() ->
                    emit(AgentStreamEvent.Delta(event.delta.text.content))
                event.hasStarted() -> emit(AgentStreamEvent.Started(event.started.messageId))
                event.hasDone() -> emit(AgentStreamEvent.Done)
                event.hasAborted() -> emit(AgentStreamEvent.Aborted)
                event.hasError() -> emit(AgentStreamEvent.Error(event.error.message))
            }
        }
    }

    /**
     * Aborts the running turn started by the user message [messageId]; a settled turn is a no-op.
     */
    suspend fun abortMessage(messageId: String) {
        val request = abortMessageRequest { this.messageId = messageId }
        when (val response = rpc.agent.abortMessage(request, emptyMap())) {
            is ResponseMessage.Success -> Unit
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    private fun persistTokens(accessToken: String, refreshToken: String) {
        settings.setAccessToken(accessToken)
        settings.setRefreshToken(refreshToken)
    }
}
