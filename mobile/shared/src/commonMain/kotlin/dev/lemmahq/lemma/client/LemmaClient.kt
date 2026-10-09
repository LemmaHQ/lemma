package dev.lemmahq.lemma.client

import kotlinx.coroutines.flow.Flow

/** A model provider as surfaced to the UI. */
data class ClientProvider(
    val id: String,
    val name: String,
    val models: List<String>,
    val enabled: Boolean
)

/** A conversation summary as surfaced to the UI. */
data class ClientConversation(
    val id: String,
    val title: String
)

/** A persisted message as surfaced to the UI. */
data class ClientMessage(
    val id: String,
    val role: String,
    val content: String,
    val createdAtSeconds: Long,
    val updatedAtSeconds: Long
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
    data class ToolStarted(val id: String, val name: String, val arguments: String) : AgentStreamEvent

    /** A tool call finished executing. */
    data class ToolFinished(
        val id: String,
        val name: String,
        val content: String,
        val isError: Boolean
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

    /** Creates an empty conversation. */
    suspend fun createConversation(): ClientConversation

    /** Lists a conversation's settled messages. */
    suspend fun listMessages(conversationId: String): List<ClientMessage>

    /** Streams one agent turn, terminating with [AgentStreamEvent.Done] or [AgentStreamEvent.Error]. */
    fun sendMessage(
        conversationId: String,
        content: String,
        providerId: String,
        model: String,
        clientMsgId: String
    ): Flow<AgentStreamEvent>
}
