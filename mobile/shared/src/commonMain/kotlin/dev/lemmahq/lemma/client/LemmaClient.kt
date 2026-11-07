package dev.lemmahq.lemma.client

import kotlinx.coroutines.flow.Flow

/**
 * The Lemma services, answered by a remote server or the local engine. Every call throws
 * [ServiceException] when it fails.
 */
interface LemmaClient {

    /** Release version of the server or local engine that answers. */
    suspend fun getVersion(): String

    /** Whether an account with the username or email [identifier] exists. */
    suspend fun checkAccount(identifier: String): Boolean

    /** Authenticates by username or email and stores the issued token pair. */
    suspend fun signIn(identifier: String, password: String)

    /** Registers a new account and stores the issued token pair. */
    suspend fun signUp(username: String, email: String, password: String)

    /**
     * Clears the stored token pair, then revokes its refresh token at the service; the pair stays
     * cleared when the revocation fails.
     */
    suspend fun signOut()

    suspend fun me(): ClientUser

    /** Lists the account's sessions, most recently updated first. */
    suspend fun listSessions(): List<ClientSession>

    suspend fun renameSession(id: String, title: String): ClientSession

    /** Deletes a session and all of its messages. */
    suspend fun deleteSession(id: String)

    suspend fun listProviders(): List<ClientProvider>

    suspend fun createProvider(input: ClientProviderInput): ClientProvider

    suspend fun updateProvider(id: String, patch: ClientProviderPatch): ClientProvider

    suspend fun deleteProvider(id: String)

    /** Fetches the live model list with a stored provider's credentials. */
    suspend fun fetchProviderModels(id: String): List<String>

    /** Fetches the live model list with ad-hoc connection details. */
    suspend fun fetchModels(
        kind: String,
        baseUrl: String,
        apiKey: String,
        modelsPath: String,
    ): List<String>

    /**
     * Sends a test request for [model] through the stored provider [id], or through [connection]
     * when [id] is null; returns the upstream failure message, empty when the model answered.
     */
    suspend fun checkProvider(id: String?, connection: ClientProviderInput, model: String): String

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
