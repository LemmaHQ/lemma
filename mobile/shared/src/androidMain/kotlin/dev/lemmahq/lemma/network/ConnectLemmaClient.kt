package dev.lemmahq.lemma.network

import com.connectrpc.ConnectException
import com.connectrpc.ResponseMessage
import dev.lemmahq.gen.lemma.v1.AgentEvent
import dev.lemmahq.gen.lemma.v1.abortMessageRequest
import dev.lemmahq.gen.lemma.v1.createSessionRequest
import dev.lemmahq.gen.lemma.v1.deleteCustomProviderRequest
import dev.lemmahq.gen.lemma.v1.deleteSessionRequest
import dev.lemmahq.gen.lemma.v1.fetchModelsRequest
import dev.lemmahq.gen.lemma.v1.listMessagesRequest
import dev.lemmahq.gen.lemma.v1.listProvidersRequest
import dev.lemmahq.gen.lemma.v1.listSessionsRequest
import dev.lemmahq.gen.lemma.v1.listWebProvidersRequest
import dev.lemmahq.gen.lemma.v1.renameSessionRequest
import dev.lemmahq.gen.lemma.v1.resumeStreamRequest
import dev.lemmahq.gen.lemma.v1.sendMessageRequest
import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.ClientCustomProviderInput
import dev.lemmahq.lemma.client.ClientCustomProviderPatch
import dev.lemmahq.lemma.client.ClientMessageTree
import dev.lemmahq.lemma.client.ClientPredefinedProviderPatch
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.ClientSession
import dev.lemmahq.lemma.client.ClientWebFunction
import dev.lemmahq.lemma.client.ClientWebProvider
import dev.lemmahq.lemma.client.ClientWebProviderPatch
import dev.lemmahq.lemma.client.LemmaClient
import kotlinx.coroutines.channels.ReceiveChannel
import kotlinx.coroutines.channels.consumeEach
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.FlowCollector
import kotlinx.coroutines.flow.flow

/** [LemmaClient] over the Connect clients of [rpc]. */
class ConnectLemmaClient(private val rpc: LemmaRpcClient) : LemmaClient {

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

    override suspend fun createCustomProvider(input: ClientCustomProviderInput): ClientProvider {
        val request = customProviderCreateRequest(input)
        return call { rpc.provider.createCustomProvider(request, emptyMap()) }.provider.toClient()
    }

    override suspend fun updateCustomProvider(
        id: String,
        patch: ClientCustomProviderPatch,
    ): ClientProvider {
        val request = customProviderUpdateRequest(id, patch)
        return call { rpc.provider.updateCustomProvider(request, emptyMap()) }.provider.toClient()
    }

    override suspend fun updatePredefinedProvider(
        id: String,
        patch: ClientPredefinedProviderPatch,
    ): ClientProvider {
        val request = predefinedProviderUpdateRequest(id, patch)
        return call { rpc.provider.updatePredefinedProvider(request, emptyMap()) }
            .provider
            .toClient()
    }

    override suspend fun listWebProviders(): List<ClientWebProvider> = call {
        rpc.provider.listWebProviders(listWebProvidersRequest {}, emptyMap())
    }
        .providersList
        .map { it.toClient() }

    override suspend fun updateWebProvider(
        id: String,
        patch: ClientWebProviderPatch,
    ): ClientWebProvider {
        val request = webProviderUpdateRequest(id, patch)
        return call { rpc.provider.updateWebProvider(request, emptyMap()) }.provider.toClient()
    }

    override suspend fun setWebProviderOrder(
        function: ClientWebFunction,
        ids: List<String>,
    ): List<ClientWebProvider> {
        val request = webProviderOrderRequest(function, ids)
        return call { rpc.provider.setWebProviderOrder(request, emptyMap()) }
            .providersList
            .map { it.toClient() }
    }

    override suspend fun deleteCustomProvider(id: String) {
        call {
            rpc.provider.deleteCustomProvider(
                deleteCustomProviderRequest { this.id = id },
                emptyMap(),
            )
        }
    }

    override suspend fun fetchModels(id: String): List<String> = call {
        rpc.provider.fetchModels(fetchModelsRequest { this.id = id }, emptyMap())
    }
        .modelsList

    override suspend fun checkProvider(id: String, model: String): String {
        val request = storedProviderCheckRequest(id, model)
        return call { rpc.provider.checkProvider(request, emptyMap()) }.error
    }

    override suspend fun createSession(): ClientSession = call {
        rpc.session.createSession(createSessionRequest {}, emptyMap())
    }
        .session
        .toClient()

    override suspend fun listMessages(sessionId: String): ClientMessageTree {
        val response = call {
            rpc.session.listMessages(listMessagesRequest { this.sessionId = sessionId }, emptyMap())
        }
        return ClientMessageTree(
            messages = response.messagesList.map { it.toClient() },
            leafId = if (response.hasLeafId()) response.leafId else null,
            activeMessageId = if (response.hasActiveMessageId()) response.activeMessageId else null,
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
