package dev.lemmahq.lemma.client

import kotlinx.coroutines.flow.Flow

/** A model provider as surfaced to the UI. */
data class ClientProvider(
    val id: String,
    val kind: String,
    val identifier: String,
    val name: String,
    val baseUrl: String,
    val apiPath: String,
    val modelsPath: String,
    val models: List<String>,
    val enabled: Boolean,
    val hasApiKey: Boolean,
)

/** Input for creating a provider; `identifier` is immutable afterwards. */
data class ClientProviderInput(
    val kind: String,
    val identifier: String,
    val name: String,
    val baseUrl: String,
    val apiKey: String = "",
    val apiPath: String = "",
    val modelsPath: String = "",
    val models: List<String> = emptyList(),
)

/** Patch input for updating a provider; null fields keep current values. */
data class ClientProviderPatch(
    val name: String? = null,
    val baseUrl: String? = null,
    val apiKey: String? = null,
    val apiPath: String? = null,
    val modelsPath: String? = null,
    val enabled: Boolean? = null,
    val models: List<String>? = null,
)

/** A conversation summary as surfaced to the UI. */
data class ClientConversation(
    val id: String,
    val title: String,
)

/** A persisted message as surfaced to the UI. */
data class ClientMessage(
    val id: String,
    val role: String,
    val content: String,
    val providerId: String?,
    val model: String?,
    val createdAtSeconds: Long,
    val updatedAtSeconds: Long,
)

/** One streamed event of an agent turn. */
sealed interface AgentStreamEvent {

    /** The user message has been committed. */
    data class Started(val messageId: String) : AgentStreamEvent

    /** A new assistant message node started streaming. */
    data class TurnStarted(val messageId: String) : AgentStreamEvent

    /** An incremental text chunk. */
    data class Delta(val text: String) : AgentStreamEvent

    /** An incremental reasoning chunk. */
    data class ThinkingDelta(val text: String) : AgentStreamEvent

    /** A tool call is about to execute. */
    data class ToolStarted(val id: String, val name: String, val arguments: String) :
        AgentStreamEvent

    /** A tool call finished executing. */
    data class ToolFinished(
        val id: String,
        val name: String,
        val content: String,
        val isError: Boolean,
    ) : AgentStreamEvent

    /** The turn completed and the assistant message persisted. */
    data class Done(val promptTokens: Long, val completionTokens: Long) : AgentStreamEvent

    /** The turn failed. */
    data class Error(val message: String) : AgentStreamEvent
}

/** Unified backend facade over the remote RPC server or the embedded local engine. */
interface LemmaClient {

    /** Authenticates by username or email and persists the session. */
    suspend fun login(login: String, password: String)

    /** Registers a new account and persists the session. */
    suspend fun signUp(username: String, email: String, password: String)

    /** Opens a session on the default local account; supported in local mode only. */
    suspend fun useDefaultAccount()

    /** Lists provider configurations of the current account. */
    suspend fun listProviders(): List<ClientProvider>

    /** Creates a provider configuration and returns the stored record. */
    suspend fun createProvider(input: ClientProviderInput): ClientProvider

    /** Applies a patch to a provider and returns the stored record. */
    suspend fun updateProvider(id: String, patch: ClientProviderPatch): ClientProvider

    /** Deletes a provider configuration. */
    suspend fun deleteProvider(id: String)

    /** Fetches the live model list using a stored provider's credentials. */
    suspend fun fetchProviderModels(id: String): List<String>

    /** Fetches the live model list for ad-hoc connection details. */
    suspend fun fetchModels(
        kind: String,
        baseUrl: String,
        apiKey: String,
        modelsPath: String,
    ): List<String>

    /** Creates an empty conversation. */
    suspend fun createConversation(): ClientConversation

    /** Lists a conversation's settled messages. */
    suspend fun listMessages(conversationId: String): List<ClientMessage>

    /**
     * Streams one agent turn, terminating with [AgentStreamEvent.Done] or [AgentStreamEvent.Error].
     */
    fun sendMessage(
        conversationId: String,
        content: String,
        providerId: String,
        model: String,
        clientMsgId: String,
    ): Flow<AgentStreamEvent>
}
