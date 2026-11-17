package dev.lemmahq.lemma.client

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf

/** A [LemmaClient] for tests that records calls and delegates answers to replaceable handlers. */
class FakeLemmaClient : LemmaClient {

    /** One received call: the method name and its arguments in order. */
    data class Call(val name: String, val args: List<Any?>) {
        constructor(name: String, vararg args: Any?) : this(name, args.toList())
    }

    val calls = mutableListOf<Call>()

    var onListSessions: suspend () -> List<ClientSession> = { emptyList() }
    var onRenameSession: suspend (id: String, title: String) -> ClientSession = { id, title ->
        ClientSession(id, title, updatedAt = 0)
    }
    var onDeleteSession: suspend (id: String) -> Unit = {}
    var onListProviders: suspend () -> List<ClientProvider> = { emptyList() }
    var onCreateCustomProvider: suspend (ClientCustomProviderInput) -> ClientProvider = {
        sampleProvider("provider-1")
    }
    var onUpdateCustomProvider:
        suspend (id: String, patch: ClientCustomProviderPatch) -> ClientProvider =
        { id, _ ->
            sampleProvider(id)
        }
    var onUpdatePredefinedProvider:
        suspend (id: String, patch: ClientPredefinedProviderPatch) -> ClientProvider =
        { id, _ ->
            samplePredefinedProvider(id)
        }
    var onListWebProviders: suspend () -> List<ClientWebProvider> = { emptyList() }
    var onUpdateWebProvider:
        suspend (id: String, patch: ClientWebProviderPatch) -> ClientWebProvider =
        { id, _ ->
            ClientWebProvider(id, ClientWebProviderKind.Native, "Native", false, "", 0, 0)
        }
    var onSetWebProviderOrder:
        suspend (function: ClientWebFunction, ids: List<String>) -> List<ClientWebProvider> =
        { _, _ ->
            emptyList()
        }
    var onDeleteCustomProvider: suspend (id: String) -> Unit = {}
    var onFetchModels: suspend (id: String) -> List<String> = { emptyList() }
    var onCheckProvider: suspend (id: String, model: String) -> String = { _, _ -> "" }
    var onCreateSession: suspend () -> ClientSession = {
        ClientSession("session-${calls.count { it.name == "createSession" }}", "", updatedAt = 0)
    }
    var onListMessages: suspend (sessionId: String) -> ClientMessageTree = {
        ClientMessageTree(emptyList())
    }
    var onSetSessionLeaf: suspend (sessionId: String, leafId: String?) -> ClientSession =
        { sessionId, leafId ->
            ClientSession(sessionId, "", updatedAt = 0, leafId = leafId)
        }
    var onSetMessageLabel:
        suspend (sessionId: String, messageId: String, label: String?) -> ClientMessage =
        { _, messageId, label ->
            ClientMessage(messageId, "user", "", label = label)
        }
    var onSendMessage:
        (
            sessionId: String,
            content: String,
            providerId: String,
            model: String,
            parentId: String?,
        ) -> Flow<AgentStreamEvent> =
        { _, _, _, _, _ ->
            flowOf(AgentStreamEvent.Started("message-1"), AgentStreamEvent.Done())
        }
    var onResumeStream: (messageId: String, offset: Long) -> Flow<AgentStreamEvent> = { _, _ ->
        flow { throw ServiceException(ServiceFailure.TurnNotRunning) }
    }
    var onAbortMessage: suspend (messageId: String) -> Unit = {}

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

    override suspend fun createCustomProvider(input: ClientCustomProviderInput): ClientProvider {
        calls += Call("createCustomProvider", input)
        return onCreateCustomProvider(input)
    }

    override suspend fun updateCustomProvider(
        id: String,
        patch: ClientCustomProviderPatch,
    ): ClientProvider {
        calls += Call("updateCustomProvider", id, patch)
        return onUpdateCustomProvider(id, patch)
    }

    override suspend fun updatePredefinedProvider(
        id: String,
        patch: ClientPredefinedProviderPatch,
    ): ClientProvider {
        calls += Call("updatePredefinedProvider", id, patch)
        return onUpdatePredefinedProvider(id, patch)
    }

    override suspend fun listWebProviders(): List<ClientWebProvider> {
        calls += Call("listWebProviders")
        return onListWebProviders()
    }

    override suspend fun updateWebProvider(
        id: String,
        patch: ClientWebProviderPatch,
    ): ClientWebProvider {
        calls += Call("updateWebProvider", id, patch)
        return onUpdateWebProvider(id, patch)
    }

    override suspend fun setWebProviderOrder(
        function: ClientWebFunction,
        ids: List<String>,
    ): List<ClientWebProvider> {
        calls += Call("setWebProviderOrder", function, ids)
        return onSetWebProviderOrder(function, ids)
    }

    override suspend fun deleteCustomProvider(id: String) {
        calls += Call("deleteCustomProvider", id)
        onDeleteCustomProvider(id)
    }

    override suspend fun fetchModels(id: String): List<String> {
        calls += Call("fetchModels", id)
        return onFetchModels(id)
    }

    override suspend fun checkProvider(id: String, model: String): String {
        calls += Call("checkProvider", id, model)
        return onCheckProvider(id, model)
    }

    override suspend fun createSession(): ClientSession {
        calls += Call("createSession")
        return onCreateSession()
    }

    override suspend fun listMessages(sessionId: String): ClientMessageTree {
        calls += Call("listMessages", sessionId)
        return onListMessages(sessionId)
    }

    override suspend fun setSessionLeaf(sessionId: String, leafId: String?): ClientSession {
        calls += Call("setSessionLeaf", sessionId, leafId)
        return onSetSessionLeaf(sessionId, leafId)
    }

    override suspend fun setMessageLabel(
        sessionId: String,
        messageId: String,
        label: String?,
    ): ClientMessage {
        calls += Call("setMessageLabel", sessionId, messageId, label)
        return onSetMessageLabel(sessionId, messageId, label)
    }

    override fun sendMessage(
        sessionId: String,
        content: String,
        providerId: String,
        model: String,
        parentId: String?,
    ): Flow<AgentStreamEvent> {
        calls += Call("sendMessage", sessionId, content, providerId, model, parentId)
        return onSendMessage(sessionId, content, providerId, model, parentId)
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
