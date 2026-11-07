package dev.lemmahq.lemma.network

import com.russhwolf.settings.MapSettings
import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.ClientMessage
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.ClientProviderInput
import dev.lemmahq.lemma.client.ClientProviderPatch
import dev.lemmahq.lemma.client.ClientToolResult
import dev.lemmahq.lemma.client.MessageStatus
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.data.InMemoryTokenStore
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.engine.ENGINE_BASE_URL
import dev.lemmahq.lemma.engine.LocalEngine
import java.io.File
import java.net.InetAddress
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
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

private const val PASSWORD = "password-1"

class ConnectLemmaClientTest {

    @get:Rule val dataDir: TemporaryFolder = TemporaryFolder.builder().assureDeletion().build()

    private val settings = SettingsRepository(MapSettings(), InMemoryTokenStore())
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
        runBlocking { engines.forEach { it.shutdown() } }
        vendor.close()
    }

    @Test
    fun answersWithTheWorkspaceVersion() = runTest {
        assertEquals(workspaceVersion(), client().getVersion())
    }

    @Test
    fun aSignedOutAccountSignsBackInByEmail() = runTest {
        val client = signedUpClient()
        settings.clearAuth()

        client.signIn("ada@example.com", PASSWORD)

        assertTrue(settings.signedIn.value)
        assertEquals(emptyList(), client.listProviders())
    }

    @Test
    fun rejectedCredentialsFailWithTheirReason() = runTest {
        val client = signedUpClient()

        val rejected = assertFailsWith<ServiceException> { client.signIn("ada", "wrong-password") }

        assertEquals(ServiceFailure.CredentialsInvalid, rejected.failure)
    }

    @Test
    fun meReturnsTheSignedUpUser() = runTest {
        val client = signedUpClient()

        val user = client.me()

        assertEquals("ada", user.username)
        assertTrue(user.id.isNotBlank())
    }

    @Test
    fun sessionsListMostRecentlyUpdatedFirst() = runTest {
        val client = signedUpClient()
        val first = client.createSession()
        val second = client.createSession()

        assertEquals(listOf(second.id, first.id), client.listSessions().map { it.id })
    }

    @Test
    fun aRejectedAccessTokenIsRotatedWithTheRefreshToken() = runTest {
        val client = signedUpClient()
        val refreshToken = checkNotNull(settings.getRefreshToken())
        settings.setTokens("expired", refreshToken)

        assertEquals(emptyList(), client.listProviders())

        assertNotEquals("expired", settings.getAccessToken())
        assertNotEquals(refreshToken, settings.getRefreshToken())
    }

    @Test
    fun providersRoundTripThroughCreateUpdateAndDelete() = runTest {
        val client = signedUpClient()

        val created = client.createProvider(vendorInput("answer"))
        val updated =
            client.updateProvider(
                created.id,
                ClientProviderPatch(
                    name = "Renamed",
                    enabled = false,
                    models = listOf("answer", "hang"),
                ),
            )
        val listed = client.listProviders()
        client.deleteProvider(created.id)

        assertEquals(
            ClientProvider(
                id = created.id,
                kind = "openai",
                identifier = "vendor",
                name = "Vendor",
                baseUrl = vendorUrl,
                apiPath = "",
                modelsPath = "",
                models = listOf("answer"),
                enabled = true,
                apiKey = "sk-1",
            ),
            created,
        )
        assertEquals(
            created.copy(name = "Renamed", enabled = false, models = listOf("answer", "hang")),
            updated,
        )
        assertEquals(listOf(updated), listed)
        assertEquals(emptyList(), client.listProviders())
        val missing = assertFailsWith<ServiceException> { client.deleteProvider(created.id) }
        assertEquals(ServiceFailure.ProviderNotFound, missing.failure)
    }

    @Test
    fun fetchesAndChecksModelsAtTheVendor() = runTest {
        val client = signedUpClient()
        val provider = client.createProvider(vendorInput("answer"))

        assertEquals(listOf("answer", "hang"), client.fetchProviderModels(provider.id))
        assertEquals(listOf("answer", "hang"), client.fetchModels("openai", vendorUrl, "sk-1", ""))
        assertEquals("", client.checkProvider(provider.id, vendorInput(), "answer"))
        assertEquals("upstream 500: boom", client.checkProvider(null, vendorInput(), "broken"))
    }

    @Test
    fun aTurnStreamsTheReplyAndPersistsBothMessages() = runTest {
        val client = signedUpClient()
        val provider = client.createProvider(vendorInput("answer"))
        val session = client.createSession()

        val events = client.sendMessage(session.id, "hi", provider.id, "answer").toList()
        val page = client.listMessages(session.id, null, 50)

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
        assertFalse(page.hasMore)
        assertEquals(
            listOf(
                ClientMessage(
                    reply.messageId,
                    "assistant",
                    "pong",
                    providerId = provider.id,
                    model = "answer",
                ),
                ClientMessage(started.messageId, "user", "hi"),
            ),
            page.messages,
        )
        assertEquals(
            emptyList(),
            client.listMessages(session.id, beforeId = started.messageId, limit = 50).messages,
        )
        assertEquals(
            listOf(reply.messageId),
            client.listMessages(session.id, null, 1).messages.map { it.id },
        )
    }

    @Test
    fun aTurnWithAToolCallStreamsAndStoresEachStep() = runTest {
        val client = signedUpClient()
        val provider = client.createProvider(vendorInput("tool"))
        val session = client.createSession()

        val events = client.sendMessage(session.id, "save a note", provider.id, "tool").toList()
        val page = client.listMessages(session.id, null, 50).messages

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
        assertEquals(listOf("assistant", "tool", "assistant", "user"), page.map { it.role })
        val (answer, result, toolStep) = page
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
        val client = signedUpClient()
        val provider = client.createProvider(vendorInput("hang"))
        val session = client.createSession()
        val started =
            client.sendMessage(session.id, "hi", provider.id, "hang").first()
                as AgentStreamEvent.Started

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
        val client = signedUpClient()
        val session = client.createSession()

        val renamed = client.renameSession(session.id, "Trip")
        val listed = client.listSessions()
        client.deleteSession(session.id)

        assertEquals(session.id to "Trip", renamed.id to renamed.title)
        assertTrue(renamed.updatedAt >= session.updatedAt && session.updatedAt > 0)
        assertEquals(listOf(renamed), listed)
        assertEquals(emptyList(), client.listSessions())
        val missing =
            assertFailsWith<ServiceException> { client.listMessages(session.id, null, 50) }
        assertEquals(ServiceFailure.SessionNotFound, missing.failure)
    }

    @Test
    fun accountsAreFoundByUsernameOrEmail() = runTest {
        val client = signedUpClient()

        assertTrue(client.checkAccount(" ada "))
        assertTrue(client.checkAccount("ada@example.com"))
        assertFalse(client.checkAccount("grace"))
    }

    @Test
    fun signingOutRevokesTheRefreshToken() = runTest {
        val client = signedUpClient()
        val refreshToken = checkNotNull(settings.getRefreshToken())

        client.signOut()

        assertFalse(settings.signedIn.value)
        settings.setTokens("expired", refreshToken)
        val rejected = assertFailsWith<ServiceException> { client.listProviders() }
        assertEquals(ServiceFailure.TokenInvalid, rejected.failure)
        assertFalse(settings.signedIn.value)
    }

    @Test
    fun signingOutWithoutATokenPairCallsNothing() = runTest {
        val client = client()

        client.signOut()

        assertFalse(settings.signedIn.value)
    }

    @Test
    fun connectionFieldsUpdateAndAnEmptyPatchKeepsTheProvider() = runTest {
        val client = signedUpClient()
        val created = client.createProvider(vendorInput("answer"))

        val updated =
            client.updateProvider(
                created.id,
                ClientProviderPatch(
                    baseUrl = "https://proxy.example.com/v1",
                    apiKey = "sk-2",
                    apiPath = "/chat",
                    modelsPath = "/models",
                ),
            )
        val unchanged = client.updateProvider(created.id, ClientProviderPatch())

        assertEquals(
            created.copy(
                baseUrl = "https://proxy.example.com/v1",
                apiKey = "sk-2",
                apiPath = "/chat",
                modelsPath = "/models",
            ),
            updated,
        )
        assertEquals(updated, unchanged)
    }

    @Test
    fun aFailingVendorEndsTheTurnWithItsError() = runTest {
        val client = signedUpClient()
        val provider = client.createProvider(vendorInput("broken"))
        val session = client.createSession()

        val events = client.sendMessage(session.id, "hi", provider.id, "broken").toList()

        assertEquals(AgentStreamEvent.Error("upstream 500: boom"), events.last().withoutTime())
    }

    @Test
    fun anAbortedTurnEndsAsAborted() = runTest {
        val client = signedUpClient()
        val provider = client.createProvider(vendorInput("hang"))
        val session = client.createSession()

        val events =
            client
                .sendMessage(session.id, "hi", provider.id, "hang")
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
        return ConnectLemmaClient(
            LemmaRpcClient(ENGINE_BASE_URL, settings, engine.transport),
            settings,
        )
    }

    private suspend fun signedUpClient(): ConnectLemmaClient =
        client().also { it.signUp("ada", "ada@example.com", PASSWORD) }

    private fun vendorInput(vararg models: String) =
        ClientProviderInput(
            kind = "openai",
            identifier = "vendor",
            name = "Vendor",
            baseUrl = vendorUrl,
            apiKey = "sk-1",
            models = models.toList(),
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

private fun workspaceVersion(): String {
    val manifest = File("../../Cargo.toml").readText()
    return Regex("""\[workspace\.package][^\[]*?version = "([^"]+)"""")
        .find(manifest)
        ?.groupValues
        ?.get(1)
        .orEmpty()
}
