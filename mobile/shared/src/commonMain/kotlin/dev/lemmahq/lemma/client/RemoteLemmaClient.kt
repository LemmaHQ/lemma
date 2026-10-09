package dev.lemmahq.lemma.client

import com.connectrpc.ResponseMessage
import dev.lemmahq.gen.lemma.v1.createConversationRequest
import dev.lemmahq.gen.lemma.v1.listMessagesRequest
import dev.lemmahq.gen.lemma.v1.listProvidersRequest
import dev.lemmahq.gen.lemma.v1.loginRequest
import dev.lemmahq.gen.lemma.v1.sendMessageRequest
import dev.lemmahq.gen.lemma.v1.signUpRequest
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.network.LemmaRpcClient
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/** [LemmaClient] backed by a remote Lemma server over Connect RPC. */
class RemoteLemmaClient(
    private val rpc: LemmaRpcClient,
    private val settings: SettingsRepository
) : LemmaClient {

    override suspend fun login(login: String, password: String) {
        val request = loginRequest {
            if (login.contains("@")) {
                this.email = login.trim()
            } else {
                this.username = login.trim()
            }
            this.password = password
        }
        when (val response = rpc.auth.login(request, emptyMap())) {
            is ResponseMessage.Success -> persistTokens(
                response.message.tokens.accessToken,
                response.message.tokens.refreshToken
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
            is ResponseMessage.Success -> persistTokens(
                response.message.tokens.accessToken,
                response.message.tokens.refreshToken
            )
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    override suspend fun useDefaultAccount() {
        throw UnsupportedOperationException("The default account is available in local mode only")
    }

    override suspend fun listProviders(): List<ClientProvider> {
        return when (val response = rpc.provider.listProviders(listProvidersRequest {}, emptyMap())) {
            is ResponseMessage.Success -> response.message.providersList.map {
                ClientProvider(id = it.id, name = it.name, models = it.modelsList, enabled = it.enabled)
            }
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    override suspend fun createConversation(): ClientConversation {
        return when (val response = rpc.conversation.createConversation(createConversationRequest {}, emptyMap())) {
            is ResponseMessage.Success -> response.message.conversation.let {
                ClientConversation(id = it.id, title = it.title)
            }
            is ResponseMessage.Failure -> throw response.cause
        }
    }

    override suspend fun listMessages(conversationId: String): List<ClientMessage> {
        val request = listMessagesRequest { this.conversationId = conversationId }
        return when (val response = rpc.conversation.listMessages(request, emptyMap())) {
            is ResponseMessage.Success -> response.message.messagesList.map {
                ClientMessage(
                    id = it.id,
                    role = it.role,
                    content = it.content,
                    createdAtSeconds = it.createdAt.seconds,
                    updatedAtSeconds = it.updatedAt.seconds
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
        clientMsgId: String
    ): Flow<AgentStreamEvent> = flow {
        val stream = rpc.agent.sendMessage(emptyMap())
        stream.sendAndClose(sendMessageRequest {
            this.conversationId = conversationId
            this.content = content
            this.providerId = providerId
            this.model = model
            this.clientMsgId = clientMsgId
        })
        for (response in stream.responseChannel()) {
            val event = response.event
            when {
                event.hasDelta() && event.delta.hasText() ->
                    emit(AgentStreamEvent.Delta(event.delta.text.content))
                event.hasDelta() && event.delta.hasThinking() ->
                    emit(AgentStreamEvent.ThinkingDelta(event.delta.thinking.content))
                event.hasStarted() ->
                    emit(AgentStreamEvent.Started(event.started.messageId))
                event.hasTurnStarted() ->
                    emit(AgentStreamEvent.TurnStarted(event.turnStarted.messageId))
                event.hasToolCallStarted() -> event.toolCallStarted.let {
                    emit(AgentStreamEvent.ToolStarted(it.callId, it.name, it.arguments))
                }
                event.hasToolCallFinished() -> event.toolCallFinished.let {
                    emit(AgentStreamEvent.ToolFinished(it.callId, it.name, it.content, it.isError))
                }
                event.hasDone() -> emit(
                    AgentStreamEvent.Done(
                        promptTokens = event.done.usage.promptTokens.toLong(),
                        completionTokens = event.done.usage.completionTokens.toLong()
                    )
                )
                event.hasError() -> emit(AgentStreamEvent.Error(event.error.message))
            }
        }
    }

    private fun persistTokens(accessToken: String, refreshToken: String) {
        settings.setAccessToken(accessToken)
        settings.setRefreshToken(refreshToken)
    }
}
