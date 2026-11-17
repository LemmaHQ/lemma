package dev.lemmahq.lemma.network

import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.ApiFormat
import dev.lemmahq.lemma.client.ClientCustomProvider
import dev.lemmahq.lemma.client.ClientCustomProviderInput
import dev.lemmahq.lemma.client.ClientCustomProviderPatch
import dev.lemmahq.lemma.client.ClientMessage
import dev.lemmahq.lemma.client.ClientMessageTree
import dev.lemmahq.lemma.client.ClientModel
import dev.lemmahq.lemma.client.ClientPredefinedProvider
import dev.lemmahq.lemma.client.ClientPredefinedProviderPatch
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.ClientToolResult
import dev.lemmahq.lemma.client.ClientWebFunction
import dev.lemmahq.lemma.client.ClientWebProviderKind
import dev.lemmahq.lemma.client.ClientWebProviderPatch
import dev.lemmahq.lemma.client.MessageStatus
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.client.activePath
import dev.lemmahq.lemma.engine.ENGINE_BASE_URL
import dev.lemmahq.lemma.engine.LocalEngine
import java.net.InetAddress
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withContext
import mockwebserver3.Dispatcher
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import mockwebserver3.RecordedRequest
import org.junit.Rule
import org.junit.rules.TemporaryFolder

class ConnectLemmaClientTest {

    @get:Rule val dataDir: TemporaryFolder = TemporaryFolder.builder().assureDeletion().build()

    private val vendor = MockWebServer()
    private val vendorCalled = CountDownLatch(1)
    private val release = CountDownLatch(1)
    private val engines = mutableListOf<LocalEngine>()
    private val vendorUrl
        get() = "http://127.0.0.1:${vendor.port}/v1"

    @BeforeTest
    fun setUp() {
        vendor.dispatcher =
            object : Dispatcher() {
                override fun dispatch(request: RecordedRequest): MockResponse = answer(request)
            }
        vendor.start(InetAddress.getByName("127.0.0.1"), 0)
    }

    @AfterTest
    fun tearDown() {
        release.countDown()
        runBlocking { engines.forEach { it.close() } }
        vendor.close()
    }

    @Test
    fun sessionsListMostRecentlyUpdatedFirst() = runTest {
        val client = client()
        val first = client.createSession()
        val second = client.createSession()

        assertEquals(listOf(second.id, first.id), client.listSessions().map { it.id })
    }

    @Test
    fun providersRoundTripThroughCreateUpdateAndDelete() = runTest {
        val client = client()

        val created = client.createCustomProvider(vendorInput("answer"))
        val updated =
            client.updateCustomProvider(
                created.id,
                ClientCustomProviderPatch(
                    name = "Renamed",
                    enabled = false,
                    models =
                        listOf(
                            ClientModel("answer", toolCalling = true),
                            ClientModel("hang", toolCalling = true),
                        ),
                ),
            )
        val listed = client.listProviders()
        client.deleteCustomProvider(created.id)

        assertEquals(
            ClientProvider(
                id = created.id,
                enabled = true,
                apiKey = "sk-1",
                source =
                    ClientCustomProvider(
                        identifier = "vendor",
                        name = "Vendor",
                        apiFormat = ApiFormat.OpenAi,
                        baseUrl = vendorUrl,
                        apiPath = "",
                        modelsPath = "",
                        models = listOf(ClientModel("answer", toolCalling = true)),
                    ),
            ),
            created,
        )
        assertEquals(
            created
                .withCustom {
                    copy(
                        name = "Renamed",
                        models =
                            listOf(
                                ClientModel("answer", toolCalling = true),
                                ClientModel("hang", toolCalling = true),
                            ),
                    )
                }
                .copy(enabled = false),
            updated,
        )
        assertEquals(listOf(updated), listed.customOnly())
        assertEquals(emptyList(), client.listProviders().customOnly())
        val missing = assertFailsWith<ServiceException> { client.deleteCustomProvider(created.id) }
        assertEquals(ServiceFailure.ProviderNotFound, missing.failure)
    }

    @Test
    fun predefinedProviderUpdatesOnlyItsUserControlledFields() = runTest {
        val client = client()
        val initial = client.listProviders().single()
        val predefined = initial.source as ClientPredefinedProvider

        assertEquals("deepseek", predefined.identifier)
        assertEquals("DeepSeek", predefined.name)
        assertEquals(listOf(ApiFormat.Anthropic, ApiFormat.OpenAi), predefined.apiFormats)
        assertEquals(ApiFormat.Anthropic, predefined.defaultApiFormat)
        assertEquals(
            listOf("deepseek-flash", "deepseek-v4-pro"),
            predefined.models.map { it.id },
        )
        assertTrue(predefined.models.all { it.toolCalling })
        assertEquals("", initial.apiKey)
        assertFalse(initial.enabled)
        val rejected =
            assertFailsWith<ServiceException> {
                client.updatePredefinedProvider(
                    initial.id,
                    ClientPredefinedProviderPatch(enabled = true),
                )
            }
        assertEquals(ServiceFailure.ProviderKeyRequired, rejected.failure)

        val updated =
            client.updatePredefinedProvider(
                initial.id,
                ClientPredefinedProviderPatch(
                    apiKey = "sk-deepseek",
                    enabled = true,
                    defaultApiFormat = ApiFormat.OpenAi,
                ),
            )

        assertEquals("sk-deepseek", updated.apiKey)
        assertTrue(updated.enabled)
        assertEquals(
            ApiFormat.OpenAi,
            (updated.source as ClientPredefinedProvider).defaultApiFormat,
        )
        val invalid =
            assertFailsWith<ServiceException> {
                client.updatePredefinedProvider(
                    initial.id,
                    ClientPredefinedProviderPatch(defaultApiFormat = ApiFormat.Gemini),
                )
            }
        assertEquals(ServiceFailure.ApiFormatInvalid, invalid.failure)
    }

    @Test
    fun webProvidersToggleSaveKeysAndReorder() = runTest {
        val client = client()
        val initial = client.listWebProviders()
        val exa = initial.first { it.kind == ClientWebProviderKind.Exa }
        val deepSeek = initial.first { it.kind == ClientWebProviderKind.DeepSeek }
        val native = initial.first { it.kind == ClientWebProviderKind.Native }

        assertTrue(native.enabled)
        assertFalse(exa.enabled)

        val rejected =
            assertFailsWith<ServiceException> {
                client.updateWebProvider(exa.id, ClientWebProviderPatch(enabled = true))
            }
        assertEquals(ServiceFailure.ProviderKeyRequired, rejected.failure)

        val enabledExa =
            client.updateWebProvider(
                exa.id,
                ClientWebProviderPatch(apiKey = "sk-exa", enabled = true),
            )
        assertTrue(enabledExa.enabled)
        assertEquals("sk-exa", enabledExa.apiKey)
        val keyedDeepSeek =
            client.updateWebProvider(deepSeek.id, ClientWebProviderPatch(apiKey = "sk-deepseek"))
        assertEquals("sk-deepseek", keyedDeepSeek.apiKey)
        assertFalse(keyedDeepSeek.enabled)

        val disabledNative =
            client.updateWebProvider(native.id, ClientWebProviderPatch(enabled = false))
        assertFalse(disabledNative.enabled)

        val searchReordered =
            client.setWebProviderOrder(ClientWebFunction.Search, listOf(deepSeek.id, exa.id))
        assertEquals(
            listOf(deepSeek.id, exa.id),
            searchReordered
                .filter { it.kind != ClientWebProviderKind.Native }
                .sortedBy { it.searchRank }
                .map { it.id },
        )

        val fetchReordered =
            client.setWebProviderOrder(
                ClientWebFunction.Fetch,
                listOf(deepSeek.id, native.id, exa.id),
            )
        assertEquals(
            listOf(deepSeek.id, native.id, exa.id),
            fetchReordered.sortedBy { it.fetchRank }.map { it.id },
        )
    }

    @Test
    fun fetchesAndChecksModelsAtTheVendor() = runTest {
        val client = client()
        val provider = client.createCustomProvider(vendorInput("answer"))

        assertEquals(listOf("answer", "hang"), client.fetchModels(provider.id))
        assertEquals("", client.checkProvider(provider.id, "answer"))
        assertEquals("upstream 500: boom", client.checkProvider(provider.id, "broken"))
    }

    @Test
    fun aTurnStreamsTheReplyAndPersistsBothMessages() = runTest {
        val client = client()
        val provider = client.createCustomProvider(vendorInput("answer"))
        val session = client.createSession()

        assertEquals(ClientMessageTree(emptyList()), client.listMessages(session.id))

        val events = client.sendMessage(session.id, "hi", provider.id, "answer", null).toList()
        val tree = client.listMessages(session.id)

        val started = events.first() as AgentStreamEvent.Started
        val reply = events[1] as AgentStreamEvent.TurnStarted
        assertEquals(
            listOf(
                    started,
                    reply,
                    AgentStreamEvent.TextDelta("pong"),
                    AgentStreamEvent.Done(),
                )
                .map { it.withoutTime() },
            events.map { it.withoutTime() },
        )
        assertTrue(events.all { it.occurredAt != null })
        assertEquals(reply.messageId, tree.leafId)
        assertNull(tree.activeMessageId)
        assertEquals(
            listOf(
                ClientMessage(started.messageId, "user", "hi"),
                ClientMessage(
                    reply.messageId,
                    "assistant",
                    "pong",
                    providerId = provider.id,
                    model = "answer",
                    parentId = started.messageId,
                ),
            ),
            tree.messages.map { it.copy(createdAt = null) },
        )
        assertTrue(tree.messages.all { it.createdAt != null })
        assertEquals(tree.messages, activePath(tree))
    }

    @Test
    fun aTurnSentAtTheRootBranchesAndTheLeafAndLabelsMove() = runTest {
        val client = client()
        val provider = client.createCustomProvider(vendorInput("answer"))
        val session = client.createSession()
        val first = client.sendMessage(session.id, "hi", provider.id, "answer", null).toList()
        val branch = client.sendMessage(session.id, "hi", provider.id, "answer", "").toList()
        val firstReply = (first[1] as AgentStreamEvent.TurnStarted).messageId
        val branchUser = (branch.first() as AgentStreamEvent.Started).messageId
        val tree = client.listMessages(session.id)

        assertEquals(
            listOf(null, null),
            tree.messages.filter { it.role == "user" }.map { it.parentId },
        )
        assertEquals(branchUser, activePath(tree).first().id)
        val moved = client.setSessionLeaf(session.id, firstReply)
        assertEquals(session.id to firstReply, moved.id to moved.leafId)
        assertEquals(firstReply, client.listMessages(session.id).leafId)
        assertEquals("Plan", client.setMessageLabel(session.id, branchUser, "Plan").label)
        assertNull(client.setMessageLabel(session.id, branchUser, null).label)
        assertNull(client.setSessionLeaf(session.id, null).leafId)
    }

    @Test
    fun aTurnWithAToolCallStreamsAndStoresEachStep() = runTest {
        val client = client()
        val provider = client.createCustomProvider(vendorInput("tool"))
        val session = client.createSession()

        val events =
            client.sendMessage(session.id, "save a note", provider.id, "tool", null).toList()
        val tree = client.listMessages(session.id)
        val messages = tree.messages

        assertEquals(
            listOf(
                "Started",
                "TurnStarted",
                "ThinkingDelta",
                "ToolCallStarted",
                "ToolCallFinished",
                "TurnStarted",
                "TextDelta",
                "Done",
            ),
            events.map { it::class.simpleName },
        )
        val call = events[3] as AgentStreamEvent.ToolCallStarted
        val finished = events[4] as AgentStreamEvent.ToolCallFinished
        assertEquals("write_file", call.name)
        assertTrue("a.txt" in call.arguments)
        assertEquals(call.callId to false, finished.callId to finished.isError)
        assertEquals(listOf("user", "assistant", "tool", "assistant"), messages.map { it.role })
        val (toolStep, result, answer) = messages.drop(1)
        assertEquals(answer.id, tree.leafId)
        assertEquals("saved", answer.content)
        assertEquals(ClientToolResult(call.callId, isError = false), result.toolResult)
        assertEquals(finished.content, result.content)
        assertEquals("plan", toolStep.thinking)
        assertEquals(
            listOf(call.callId to "write_file"),
            toolStep.toolCalls.map { it.id to it.name },
        )
        assertTrue(
            toolStep.toolCalls.single().let { it.startedAt != null && it.finishedAt != null }
        )
        assertTrue(toolStep.thinkingStartedAt != null && toolStep.thinkingFinishedAt != null)
        assertEquals(MessageStatus.Done, toolStep.status)
    }

    @Test
    fun aRunningTurnResumesAfterTheEventsAlreadyReceived() = runTest {
        val client = client()
        val provider = client.createCustomProvider(vendorInput("hang"))
        val session = client.createSession()
        val started =
            client.sendMessage(session.id, "hi", provider.id, "hang", null).first()
                as AgentStreamEvent.Started
        assertEquals(started.messageId, client.listMessages(session.id).activeMessageId)

        val resumed =
            client
                .resumeStream(started.messageId, offset = 1)
                .onEach { event ->
                    if (event is AgentStreamEvent.TurnStarted) {
                        assertTrue(
                            withContext(Dispatchers.IO) { vendorCalled.await(30, TimeUnit.SECONDS) }
                        )
                        client.abortMessage(started.messageId)
                    }
                }
                .toList()

        assertEquals(
            listOf("TurnStarted", "Aborted"),
            resumed.map { it::class.simpleName },
        )
        val ended =
            assertFailsWith<ServiceException> {
                client.resumeStream(started.messageId, offset = 0).toList()
            }
        assertEquals(ServiceFailure.TurnNotRunning, ended.failure)
    }

    @Test
    fun sessionsAreRenamedAndDeleted() = runTest {
        val client = client()
        val session = client.createSession()

        val renamed = client.renameSession(session.id, "Trip")
        val listed = client.listSessions()
        client.deleteSession(session.id)

        assertEquals(session.id to "Trip", renamed.id to renamed.title)
        assertTrue(renamed.updatedAt >= session.updatedAt && session.updatedAt > 0)
        assertEquals(listOf(renamed), listed)
        assertEquals(emptyList(), client.listSessions())
        val missing = assertFailsWith<ServiceException> { client.listMessages(session.id) }
        assertEquals(ServiceFailure.SessionNotFound, missing.failure)
    }

    @Test
    fun connectionFieldsUpdateAndAnEmptyPatchKeepsTheProvider() = runTest {
        val client = client()
        val created = client.createCustomProvider(vendorInput("answer"))

        val updated =
            client.updateCustomProvider(
                created.id,
                ClientCustomProviderPatch(
                    baseUrl = "https://proxy.example.com/v1",
                    apiKey = "sk-2",
                    apiPath = "/chat",
                    modelsPath = "/models",
                ),
            )
        val unchanged = client.updateCustomProvider(created.id, ClientCustomProviderPatch())

        assertEquals(
            created
                .withCustom {
                    copy(
                        baseUrl = "https://proxy.example.com/v1",
                        apiPath = "/chat",
                        modelsPath = "/models",
                    )
                }
                .copy(apiKey = "sk-2"),
            updated,
        )
        assertEquals(updated, unchanged)
    }

    @Test
    fun aFailingVendorEndsTheTurnWithItsError() = runTest {
        val client = client()
        val provider = client.createCustomProvider(vendorInput("broken"))
        val session = client.createSession()

        val events = client.sendMessage(session.id, "hi", provider.id, "broken", null).toList()

        assertEquals(AgentStreamEvent.Error("upstream 500: boom"), events.last().withoutTime())
    }

    @Test
    fun anAbortedTurnEndsAsAborted() = runTest {
        val client = client()
        val provider = client.createCustomProvider(vendorInput("hang"))
        val session = client.createSession()

        val events =
            client
                .sendMessage(session.id, "hi", provider.id, "hang", null)
                .onEach { event ->
                    if (event is AgentStreamEvent.Started) {
                        assertTrue(
                            withContext(Dispatchers.IO) { vendorCalled.await(30, TimeUnit.SECONDS) }
                        )
                        client.abortMessage(event.messageId)
                    }
                }
                .toList()

        assertEquals(AgentStreamEvent.Aborted(), events.last().withoutTime())
    }

    private suspend fun client(): ConnectLemmaClient {
        val engine = LocalEngine.open(dataDir.newFolder().path).also { engines += it }
        return ConnectLemmaClient(LemmaRpcClient(ENGINE_BASE_URL, engine.transport))
    }

    private fun vendorInput(vararg models: String) =
        ClientCustomProviderInput(
            apiFormat = ApiFormat.OpenAi,
            identifier = "vendor",
            name = "Vendor",
            baseUrl = vendorUrl,
            apiKey = "sk-1",
            models = models.map { ClientModel(it, toolCalling = true) },
        )

    private fun answer(request: RecordedRequest): MockResponse {
        val body = request.body?.utf8().orEmpty()
        return when {
            request.url.encodedPath == "/v1/models" ->
                response(200, "application/json", """{"data":[{"id":"answer"},{"id":"hang"}]}""")
            "\"model\":\"answer\"" in body ->
                response(
                    200,
                    "text/event-stream",
                    sse(
                        """{"choices":[{"delta":{"content":"pong"}}]}""",
                        """{"choices":[{"delta":{},"finish_reason":"stop"}]}""",
                        "[DONE]",
                    ),
                )
            "\"model\":\"tool\"" in body && "\"role\":\"tool\"" in body ->
                response(
                    200,
                    "text/event-stream",
                    sse(
                        """{"choices":[{"delta":{"content":"saved"}}]}""",
                        """{"choices":[{"delta":{},"finish_reason":"stop"}]}""",
                        "[DONE]",
                    ),
                )
            "\"model\":\"tool\"" in body ->
                response(
                    200,
                    "text/event-stream",
                    sse(
                        """{"choices":[{"delta":{"reasoning_content":"plan"}}]}""",
                        """{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1",""" +
                            """"function":{"name":"write_file","arguments":""" +
                            """"{\"path\":\"a.txt\",\"content\":\"hi\"}"}}]}}]}""",
                        """{"choices":[{"delta":{},"finish_reason":"tool_calls"}]}""",
                        "[DONE]",
                    ),
                )
            "\"model\":\"hang\"" in body -> {
                vendorCalled.countDown()
                release.await()
                response(500, "text/plain", "released")
            }
            else -> response(500, "text/plain", "boom")
        }
    }
}

private fun List<ClientProvider>.customOnly(): List<ClientProvider> = filter {
    it.source is ClientCustomProvider
}

private val ClientProvider.custom: ClientCustomProvider
    get() = source as ClientCustomProvider

private fun ClientProvider.withCustom(change: ClientCustomProvider.() -> ClientCustomProvider) =
    copy(source = custom.change())

private fun AgentStreamEvent.withoutTime(): AgentStreamEvent =
    when (this) {
        is AgentStreamEvent.Started -> copy(occurredAt = null)
        is AgentStreamEvent.TurnStarted -> copy(occurredAt = null)
        is AgentStreamEvent.TextDelta -> copy(occurredAt = null)
        is AgentStreamEvent.ThinkingDelta -> copy(occurredAt = null)
        is AgentStreamEvent.ToolCallStarted -> copy(occurredAt = null)
        is AgentStreamEvent.ToolCallFinished -> copy(occurredAt = null)
        is AgentStreamEvent.Done -> copy(occurredAt = null)
        is AgentStreamEvent.Aborted -> copy(occurredAt = null)
        is AgentStreamEvent.Error -> copy(occurredAt = null)
        is AgentStreamEvent.Unknown -> copy(occurredAt = null)
    }

private fun response(code: Int, contentType: String, body: String): MockResponse =
    MockResponse.Builder().code(code).setHeader("Content-Type", contentType).body(body).build()

private fun sse(vararg data: String): String = data.joinToString("") { "data: $it\n\n" }
