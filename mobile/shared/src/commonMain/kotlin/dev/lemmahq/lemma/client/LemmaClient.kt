package dev.lemmahq.lemma.client

import kotlinx.coroutines.flow.Flow

/**
 * The Lemma services, answered by the local engine. Every call throws [ServiceException] when it
 * fails.
 */
interface LemmaClient {

    /** Release version of the local engine that answers. */
    suspend fun getVersion(): String

    /** Lists the sessions, most recently updated first. */
    suspend fun listSessions(): List<ClientSession>

    suspend fun renameSession(id: String, title: String): ClientSession

    /** Deletes a session and all of its messages. */
    suspend fun deleteSession(id: String)

    suspend fun listProviders(): List<ClientProvider>

    suspend fun createCustomProvider(input: ClientCustomProviderInput): ClientProvider

    suspend fun updateCustomProvider(id: String, patch: ClientCustomProviderPatch): ClientProvider

    suspend fun updatePredefinedProvider(
        id: String,
        patch: ClientPredefinedProviderPatch,
    ): ClientProvider

    suspend fun listWebProviders(): List<ClientWebProvider>

    suspend fun updateWebProvider(id: String, patch: ClientWebProviderPatch): ClientWebProvider

    suspend fun setWebProviderOrder(
        function: ClientWebFunction,
        ids: List<String>,
    ): List<ClientWebProvider>

    suspend fun deleteCustomProvider(id: String)

    /** Fetches the live model list with a stored custom provider's credentials. */
    suspend fun fetchProviderModels(id: String): List<String>

    /** Fetches the live model list with ad-hoc custom connection details. */
    suspend fun fetchModels(
        apiFormat: String,
        baseUrl: String,
        apiKey: String,
        modelsPath: String,
    ): List<String>

    /** Sends a test request for [model] through the stored provider [id]. */
    suspend fun checkProvider(id: String, model: String): String

    /** Sends a test request for [model] through ad-hoc custom connection details. */
    suspend fun checkCustomProvider(connection: ClientCustomProviderInput, model: String): String

    suspend fun createSession(): ClientSession

    /**
     * Lists up to [limit] of a session's messages, newest first, before the message [beforeId] when
     * set.
     */
    suspend fun listMessages(sessionId: String, beforeId: String?, limit: Int): ClientMessagePage

    /**
     * Streams one agent turn from its [AgentStreamEvent.Started] event; the turn keeps running on
     * the service when the stream breaks.
     */
    fun sendMessage(
        sessionId: String,
        content: String,
        providerId: String,
        model: String,
    ): Flow<AgentStreamEvent>

    /**
     * Streams the running turn started by the user message [messageId], skipping its first [offset]
     * events; fails with [ServiceFailure.TurnNotRunning] once the turn has ended.
     */
    fun resumeStream(messageId: String, offset: Long): Flow<AgentStreamEvent>

    /**
     * Aborts the running turn started by the user message [messageId]; a settled turn is a no-op.
     */
    suspend fun abortMessage(messageId: String)
}
