package dev.lemmahq.lemma.client

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf

/**
 * A [LemmaClient] for tests. Each call is appended to [calls] and answered by the handler named
 * after it, which succeeds with an empty or sample result until the test replaces it.
 */
class FakeLemmaClient : LemmaClient {

    /** One received call: the method name and its arguments in order. */
    data class Call(val name: String, val args: List<Any?>) {
        constructor(name: String, vararg args: Any?) : this(name, args.toList())
    }

    val calls = mutableListOf<Call>()

    var onGetVersion: suspend () -> String = { "1.0.0" }
    var onCheckAccount: suspend (identifier: String) -> Boolean = { true }
    var onSignIn: suspend (identifier: String, password: String) -> Unit = { _, _ -> }
    var onSignUp: suspend (username: String, email: String, password: String) -> Unit = { _, _, _ ->
    }
    var onSignOut: suspend () -> Unit = {}
    var onMe: suspend () -> ClientUser = { ClientUser("user-1", "ada") }
    var onListSessions: suspend () -> List<ClientSession> = { emptyList() }
    var onRenameSession: suspend (id: String, title: String) -> ClientSession = { id, title ->
        ClientSession(id, title, updatedAt = 0)
    }
    var onDeleteSession: suspend (id: String) -> Unit = {}
    var onListProviders: suspend () -> List<ClientProvider> = { emptyList() }
    var onCreateProvider: suspend (ClientProviderInput) -> ClientProvider = {
        sampleProvider("provider-1")
    }
    var onUpdateProvider: suspend (id: String, patch: ClientProviderPatch) -> ClientProvider =
        { id, _ ->
            sampleProvider(id)
        }
    var onDeleteProvider: suspend (id: String) -> Unit = {}
    var onFetchProviderModels: suspend (id: String) -> List<String> = { emptyList() }
    var onFetchModels:
        suspend (kind: String, baseUrl: String, apiKey: String, modelsPath: String) -> List<
                String
            > =
        { _, _, _, _ ->
            emptyList()
        }
    var onCheckProvider:
        suspend (id: String?, connection: ClientProviderInput, model: String) -> String =
        { _, _, _ ->
            ""
        }
    var onCreateSession: suspend () -> ClientSession = {
        ClientSession("session-${calls.count { it.name == "createSession" }}", "", updatedAt = 0)
    }
    var onListMessages: suspend (sessionId: String, beforeId: String?) -> ClientMessagePage =
        { _, _ ->
            ClientMessagePage(emptyList(), hasMore = false)
        }
    var onSendMessage:
        (sessionId: String, content: String, providerId: String, model: String) -> Flow<
                AgentStreamEvent
            > =
        { _, _, _, _ ->
            flowOf(AgentStreamEvent.Started("message-1"), AgentStreamEvent.Done())
        }
    var onResumeStream: (messageId: String, offset: Long) -> Flow<AgentStreamEvent> = { _, _ ->
        flow { throw ServiceException(ServiceFailure.TurnNotRunning) }
    }
    var onAbortMessage: suspend (messageId: String) -> Unit = {}

    override suspend fun getVersion(): String {
        calls += Call("getVersion")
        return onGetVersion()
    }

    override suspend fun checkAccount(identifier: String): Boolean {
        calls += Call("checkAccount", identifier)
        return onCheckAccount(identifier)
    }

    override suspend fun signIn(identifier: String, password: String) {
        calls += Call("signIn", identifier, password)
        onSignIn(identifier, password)
    }

    override suspend fun signUp(username: String, email: String, password: String) {
        calls += Call("signUp", username, email, password)
        onSignUp(username, email, password)
    }

    override suspend fun signOut() {
        calls += Call("signOut")
        onSignOut()
    }

    override suspend fun me(): ClientUser {
        calls += Call("me")
        return onMe()
    }

    override suspend fun listSessions(): List<ClientSession> {
        calls += Call("listSessions")
        return onListSessions()
    }

    override suspend fun renameSession(id: String, title: String): ClientSession {
        calls += Call("renameSession", id, title)
        return onRenameSession(id, title)
    }

    override suspend fun deleteSession(id: String) {
        calls += Call("deleteSession", id)
        onDeleteSession(id)
    }

    override suspend fun listProviders(): List<ClientProvider> {
        calls += Call("listProviders")
        return onListProviders()
    }

    override suspend fun createProvider(input: ClientProviderInput): ClientProvider {
        calls += Call("createProvider", input)
        return onCreateProvider(input)
    }

    override suspend fun updateProvider(id: String, patch: ClientProviderPatch): ClientProvider {
        calls += Call("updateProvider", id, patch)
        return onUpdateProvider(id, patch)
    }

    override suspend fun deleteProvider(id: String) {
        calls += Call("deleteProvider", id)
        onDeleteProvider(id)
    }

    override suspend fun fetchProviderModels(id: String): List<String> {
        calls += Call("fetchProviderModels", id)
        return onFetchProviderModels(id)
    }

    override suspend fun fetchModels(
        kind: String,
        baseUrl: String,
        apiKey: String,
        modelsPath: String,
    ): List<String> {
        calls += Call("fetchModels", kind, baseUrl, apiKey, modelsPath)
        return onFetchModels(kind, baseUrl, apiKey, modelsPath)
    }

    override suspend fun checkProvider(
        id: String?,
        connection: ClientProviderInput,
        model: String,
    ): String {
        calls += Call("checkProvider", id, connection, model)
        return onCheckProvider(id, connection, model)
    }

    override suspend fun createSession(): ClientSession {
        calls += Call("createSession")
        return onCreateSession()
    }

    /** Records the call without [limit], which the session view always sets to its page size. */
    override suspend fun listMessages(
        sessionId: String,
        beforeId: String?,
        limit: Int,
    ): ClientMessagePage {
        calls += Call("listMessages", sessionId, beforeId)
        return onListMessages(sessionId, beforeId)
    }

    override fun sendMessage(
        sessionId: String,
        content: String,
        providerId: String,
        model: String,
    ): Flow<AgentStreamEvent> {
        calls += Call("sendMessage", sessionId, content, providerId, model)
        return onSendMessage(sessionId, content, providerId, model)
    }

    override fun resumeStream(messageId: String, offset: Long): Flow<AgentStreamEvent> {
        calls += Call("resumeStream", messageId, offset)
        return onResumeStream(messageId, offset)
    }

    override suspend fun abortMessage(messageId: String) {
        calls += Call("abortMessage", messageId)
        onAbortMessage(messageId)
    }
}
