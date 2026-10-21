package dev.lemmahq.lemma.client

import com.connectrpc.ResponseMessage
import dev.lemmahq.gen.lemma.v1.Provider
import dev.lemmahq.gen.lemma.v1.ProviderKind
import dev.lemmahq.gen.lemma.v1.abortMessageRequest
import dev.lemmahq.gen.lemma.v1.createConversationRequest
import dev.lemmahq.gen.lemma.v1.createProviderRequest
import dev.lemmahq.gen.lemma.v1.deleteProviderRequest
import dev.lemmahq.gen.lemma.v1.fetchModelsRequest
import dev.lemmahq.gen.lemma.v1.listMessagesRequest
import dev.lemmahq.gen.lemma.v1.listProvidersRequest
import dev.lemmahq.gen.lemma.v1.loginRequest
import dev.lemmahq.gen.lemma.v1.providerModelsPatch
import dev.lemmahq.gen.lemma.v1.sendMessageRequest
import dev.lemmahq.gen.lemma.v1.signUpRequest
import dev.lemmahq.gen.lemma.v1.updateProviderRequest
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.network.LemmaRpcClient
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/** [LemmaClient] backed by a remote Lemma server over Connect RPC. */
class RemoteLemmaClient(
    private val rpc: LemmaRpcClient,
    private val settings: SettingsRepository,
) : LemmaClient {

    override suspend fun login(login: String, password: String) {
        val request = loginRequest {
            this.login = login.trim()
            this.password = password
        }
        when (val response = rpc.auth.login(request, emptyMap())) {
            is ResponseMessage.Success ->
                persistTokens(
                    response.message.tokens.accessToken,
                    response.message.tokens.refreshToken,
                )
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    override suspend fun signUp(username: String, email: String, password: String) {
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

    override suspend fun useDefaultAccount() {
        throw UnsupportedOperationException("The default account is available in local mode only")
    }

    override suspend fun listProviders(): List<ClientProvider> {
        return when (
            val response = rpc.provider.listProviders(listProvidersRequest {}, emptyMap())
        ) {
            is ResponseMessage.Success -> response.message.providersList.map { it.toClient() }
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    override suspend fun createProvider(input: ClientProviderInput): ClientProvider {
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
        return when (val response = rpc.provider.updateProvider(request, emptyMap())) {
            is ResponseMessage.Success -> response.message.provider.toClient()
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    override suspend fun deleteProvider(id: String) {
        val request = deleteProviderRequest { this.id = id }
        when (val response = rpc.provider.deleteProvider(request, emptyMap())) {
            is ResponseMessage.Success -> Unit
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    override suspend fun fetchProviderModels(id: String): List<String> {
        val request = fetchModelsRequest { this.id = id }
        return when (val response = rpc.provider.fetchModels(request, emptyMap())) {
            is ResponseMessage.Success -> response.message.modelsList
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    override suspend fun fetchModels(
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

    override suspend fun createConversation(): ClientConversation {
        return when (
            val response =
                rpc.conversation.createConversation(createConversationRequest {}, emptyMap())
        ) {
            is ResponseMessage.Success ->
                response.message.conversation.let {
                    ClientConversation(id = it.id, title = it.title)
                }
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    override suspend fun listMessages(conversationId: String): List<ClientMessage> {
        val request = listMessagesRequest { this.conversationId = conversationId }
        return when (val response = rpc.conversation.listMessages(request, emptyMap())) {
            is ResponseMessage.Success ->
                response.message.messagesList.map {
                    ClientMessage(
                        id = it.id,
                        role = it.role,
                        content = it.content,
                        providerId = it.providerId.ifBlank { null },
                        model = it.model.ifBlank { null },
                        createdAtSeconds = it.createdAt.seconds,
                        updatedAtSeconds = it.updatedAt.seconds,
                    )
                }
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    override fun sendMessage(
        conversationId: String,
        content: String,
        providerId: String,
        model: String,
        clientMsgId: String,
    ): Flow<AgentStreamEvent> = flow {
        val stream = rpc.agent.sendMessage(emptyMap())
        stream.sendAndClose(
            sendMessageRequest {
                this.conversationId = conversationId
                this.content = content
                this.providerId = providerId
                this.model = model
                this.clientMsgId = clientMsgId
            }
        )
        for (response in stream.responseChannel()) {
            val event = response.event
            when {
                event.hasDelta() && event.delta.hasText() ->
                    emit(AgentStreamEvent.Delta(event.delta.text.content))
                event.hasDelta() && event.delta.hasThinking() ->
                    emit(AgentStreamEvent.ThinkingDelta(event.delta.thinking.content))
                event.hasStarted() -> emit(AgentStreamEvent.Started(event.started.messageId))
                event.hasTurnStarted() ->
                    emit(AgentStreamEvent.TurnStarted(event.turnStarted.messageId))
                event.hasToolCallStarted() ->
                    event.toolCallStarted.let {
                        emit(AgentStreamEvent.ToolStarted(it.callId, it.name, it.arguments))
                    }
                event.hasToolCallFinished() ->
                    event.toolCallFinished.let {
                        emit(
                            AgentStreamEvent.ToolFinished(
                                it.callId,
                                it.name,
                                it.content,
                                it.isError,
                            )
                        )
                    }
                event.hasDone() ->
                    emit(
                        AgentStreamEvent.Done(
                            promptTokens = event.done.usage.promptTokens.toLong(),
                            completionTokens = event.done.usage.completionTokens.toLong(),
                        )
                    )
                event.hasAborted() -> emit(AgentStreamEvent.Aborted)
                event.hasError() -> emit(AgentStreamEvent.Error(event.error.message))
            }
        }
    }

    override suspend fun abortMessage(messageId: String) {
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

private fun Provider.toClient(): ClientProvider {
    return ClientProvider(
        id = id,
        kind = providerKindString(kind),
        identifier = identifier,
        name = name,
        baseUrl = baseUrl,
        apiPath = apiPath,
        modelsPath = modelsPath,
        models = modelsList,
        enabled = enabled,
        hasApiKey = apiKey.isNotBlank(),
    )
}

private fun providerKindString(kind: ProviderKind): String {
    return when (kind) {
        ProviderKind.PROVIDER_KIND_OPENAI -> "openai"
        ProviderKind.PROVIDER_KIND_ANTHROPIC -> "anthropic"
        ProviderKind.PROVIDER_KIND_GEMINI -> "gemini"
        else -> throw IllegalArgumentException("Unknown provider kind: $kind")
    }
}

private fun providerKindEnum(kind: String): ProviderKind {
    return when (kind) {
        "openai" -> ProviderKind.PROVIDER_KIND_OPENAI
        "anthropic" -> ProviderKind.PROVIDER_KIND_ANTHROPIC
        "gemini" -> ProviderKind.PROVIDER_KIND_GEMINI
        else -> throw IllegalArgumentException("Unknown provider kind: $kind")
    }
}
