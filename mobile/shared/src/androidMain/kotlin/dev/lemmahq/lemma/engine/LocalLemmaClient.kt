package dev.lemmahq.lemma.engine

import android.content.Context
import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.ClientConversation
import dev.lemmahq.lemma.client.ClientMessage
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.ClientProviderInput
import dev.lemmahq.lemma.client.ClientProviderPatch
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.uniffi.LemmaEngine
import dev.lemmahq.lemma.uniffi.MobileAgentEvent
import dev.lemmahq.lemma.uniffi.MobileProvider
import dev.lemmahq.lemma.uniffi.MobileSession
import dev.lemmahq.lemma.uniffi.ProviderUpdate
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/** [LemmaClient] backed by the embedded Rust engine running in-process. */
class LocalLemmaClient
private constructor(
    private val engine: LemmaEngine,
    private val settings: SettingsRepository,
) : LemmaClient {

    companion object {

        /** Opens the embedded engine and returns the local facade over it. */
        suspend fun create(context: Context, settings: SettingsRepository): LocalLemmaClient {
            return LocalLemmaClient(LocalEngine.get(context, settings), settings)
        }
    }

    override suspend fun login(login: String, password: String) {
        persist(engine.login(login, password))
    }

    override suspend fun signUp(username: String, email: String, password: String) {
        persist(engine.signUp(username, email, password))
    }

    override suspend fun useDefaultAccount() {
        persist(engine.useDefaultAccount())
    }

    override suspend fun listProviders(): List<ClientProvider> {
        return engine.listProviders(userId()).map { it.toClient() }
    }

    override suspend fun createProvider(input: ClientProviderInput): ClientProvider {
        return engine
            .createProvider(
                userId(),
                input.kind,
                input.identifier,
                input.name,
                input.baseUrl,
                input.apiKey,
                input.apiPath,
                input.modelsPath,
                input.models,
            )
            .toClient()
    }

    override suspend fun updateProvider(id: String, patch: ClientProviderPatch): ClientProvider {
        return engine
            .updateProvider(
                userId(),
                id,
                ProviderUpdate(
                    name = patch.name,
                    baseUrl = patch.baseUrl,
                    apiKey = patch.apiKey,
                    apiPath = patch.apiPath,
                    modelsPath = patch.modelsPath,
                    enabled = patch.enabled,
                    models = patch.models,
                ),
            )
            .toClient()
    }

    override suspend fun deleteProvider(id: String) {
        engine.deleteProvider(userId(), id)
    }

    override suspend fun fetchProviderModels(id: String): List<String> {
        return engine.fetchProviderModels(userId(), id)
    }

    override suspend fun fetchModels(
        kind: String,
        baseUrl: String,
        apiKey: String,
        modelsPath: String,
    ): List<String> {
        return engine.fetchModels(kind, baseUrl, apiKey, modelsPath)
    }

    override suspend fun createConversation(): ClientConversation {
        return engine.createConversation(userId()).let {
            ClientConversation(id = it.id, title = it.title)
        }
    }

    override suspend fun listMessages(conversationId: String): List<ClientMessage> {
        return engine.listMessages(userId(), conversationId, null, 0).messages.map {
            ClientMessage(
                id = it.id,
                role = it.role,
                content = it.text,
                providerId = it.providerId,
                model = it.model,
                createdAtSeconds = it.createdAtSeconds,
                updatedAtSeconds = it.createdAtSeconds,
            )
        }
    }

    override fun sendMessage(
        conversationId: String,
        content: String,
        providerId: String,
        model: String,
        clientMsgId: String,
    ): Flow<AgentStreamEvent> {
        return engine
            .sendMessageEvents(
                userId = userId(),
                conversationId = conversationId,
                content = content,
                providerId = providerId,
                model = model,
            )
            .map { it.toStreamEvent() }
    }

    private fun userId(): String {
        return settings.getLocalUserId()
            ?: throw IllegalStateException("No local session; sign in first")
    }

    private fun persist(session: MobileSession) {
        settings.setLocalUserId(session.user.id)
        settings.setAccessToken(session.accessToken)
        settings.setRefreshToken(session.refreshToken)
    }
}

private fun MobileProvider.toClient(): ClientProvider {
    return ClientProvider(
        id = id,
        kind = kind,
        identifier = identifier,
        name = name,
        baseUrl = baseUrl,
        apiPath = apiPath,
        modelsPath = modelsPath,
        models = models,
        enabled = enabled,
        hasApiKey = apiKey.isNotBlank(),
    )
}

private fun MobileAgentEvent.toStreamEvent(): AgentStreamEvent {
    return when (this) {
        is MobileAgentEvent.Started -> AgentStreamEvent.Started(messageId)
        is MobileAgentEvent.TurnStarted -> AgentStreamEvent.TurnStarted(messageId)
        is MobileAgentEvent.Delta -> AgentStreamEvent.Delta(text)
        is MobileAgentEvent.ThinkingDelta -> AgentStreamEvent.ThinkingDelta(text)
        is MobileAgentEvent.ToolStarted -> AgentStreamEvent.ToolStarted(id, name, arguments)
        is MobileAgentEvent.ToolFinished ->
            AgentStreamEvent.ToolFinished(id, name, content, isError)
        is MobileAgentEvent.Done -> AgentStreamEvent.Done(inputTokens, outputTokens)
        is MobileAgentEvent.Error -> AgentStreamEvent.Error(message)
    }
}
