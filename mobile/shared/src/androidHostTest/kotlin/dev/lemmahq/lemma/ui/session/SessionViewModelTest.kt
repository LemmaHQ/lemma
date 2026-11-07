package dev.lemmahq.lemma.ui.session

import androidx.lifecycle.SavedStateHandle
import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.russhwolf.settings.MapSettings
import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.ClientMessage
import dev.lemmahq.lemma.client.ClientMessagePage
import dev.lemmahq.lemma.client.ClientSession
import dev.lemmahq.lemma.client.ClientToolCall
import dev.lemmahq.lemma.client.ClientToolResult
import dev.lemmahq.lemma.client.FakeLemmaClient
import dev.lemmahq.lemma.client.FakeLemmaClient.Call
import dev.lemmahq.lemma.client.MessageStatus
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.client.sampleMessage
import dev.lemmahq.lemma.client.sampleProvider
import dev.lemmahq.lemma.client.sampleSession
import dev.lemmahq.lemma.data.InMemoryTokenStore
import dev.lemmahq.lemma.data.LocalMessageRepository
import dev.lemmahq.lemma.data.ModelSelection
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.db.LemmaDatabase
import dev.lemmahq.lemma.i18n.UiText
import dev.lemmahq.lemma.i18n.errorText
import dev.lemmahq.lemma.ui.session.MessageRole.Assistant
import dev.lemmahq.lemma.ui.session.MessageRole.User
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.consumeAsFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.error_model_required

@OptIn(ExperimentalCoroutinesApi::class)
class SessionViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val openai = sampleProvider("openai", "gpt-4o", "gpt-4o-mini")
    private val client = FakeLemmaClient().apply { onListProviders = { listOf(openai) } }
    private val settings = SettingsRepository(MapSettings(), InMemoryTokenStore())
    private val messageCache =
        LocalMessageRepository(
            LemmaDatabase(
                JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY).also {
                    LemmaDatabase.Schema.create(it)
                }
            ),
            dispatcher,
        )
    private val trip = sampleSession("trip", "Trip")
    private val work = sampleSession("work", "Work")

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun TestScope.viewModel(state: SavedStateHandle = SavedStateHandle()) =
        SessionViewModel(client, settings, messageCache, state).also {
            it.loadProviders()
            advanceUntilIdle()
        }

    private val SessionViewModel.shown
        get() = messages.map { Triple(it.role, it.content, it.status) }

    private fun TestScope.send(viewModel: SessionViewModel, text: String) {
        viewModel.changeInput(text)
        viewModel.send()
        advanceUntilIdle()
    }

    private fun TestScope.open(viewModel: SessionViewModel, session: ClientSession) {
        viewModel.selectSession(session)
        advanceUntilIdle()
    }

    @Test
    fun sessionsLoadWhenTheViewModelStartsAndRefresh() = runTest {
        client.onListSessions = { listOf(trip) }
        val viewModel = SessionViewModel(client, settings, messageCache, SavedStateHandle())
        advanceUntilIdle()
        assertEquals(listOf(trip), viewModel.sessions)

        client.onListSessions = { listOf(work, trip) }
        viewModel.refreshSessions()
        advanceUntilIdle()

        assertEquals(listOf(work, trip), viewModel.sessions)
    }

    @Test
    fun theSelectionStaysWhileItIsOfferedAndIsStoredAsTheDefault() = runTest {
        settings.setModelSelection(ModelSelection("openai", "gpt-4o-mini"))
        val viewModel = viewModel()
        assertEquals(ModelSelection("openai", "gpt-4o-mini"), viewModel.selection)

        viewModel.selectModel(ModelSelection("openai", "gpt-4o"))
        viewModel.loadProviders()
        advanceUntilIdle()
        assertEquals(ModelSelection("openai", "gpt-4o"), viewModel.selection)
        assertEquals(ModelSelection("openai", "gpt-4o"), settings.getModelSelection())

        client.onListProviders = { listOf(openai.copy(models = listOf("gpt-4o-mini"))) }
        viewModel.loadProviders()
        advanceUntilIdle()
        assertEquals(ModelSelection("openai", "gpt-4o-mini"), viewModel.selection)
    }

    @Test
    fun sendingWithoutAModelAsksForOne() = runTest {
        client.onListProviders = { emptyList() }
        val viewModel = viewModel()

        send(viewModel, "Hello")

        assertEquals(UiText.Resource(Res.string.error_model_required), viewModel.error)
        assertEquals("Hello", viewModel.input)
        assertEquals(emptyList(), viewModel.messages)
        assertEquals(listOf(Call("listSessions"), Call("listProviders")), client.calls)
    }

    @Test
    fun theFirstTurnCreatesTheSessionAndStreamsIntoItsReply() = runTest {
        val events = Channel<AgentStreamEvent>(Channel.UNLIMITED)
        client.onSendMessage = { _, _, _, _ -> events.consumeAsFlow() }
        val viewModel = viewModel()

        viewModel.changeInput("  Hello  ")
        viewModel.send()
        assertEquals("", viewModel.input)
        assertTrue(viewModel.turnRunning)
        events.send(AgentStreamEvent.Started("q1"))
        advanceUntilIdle()
        assertTrue(viewModel.stoppable)
        assertEquals(sampleSession("session-1", ""), viewModel.currentSession)
        assertEquals(listOf(sampleSession("session-1", "")), viewModel.sessions)

        events.send(AgentStreamEvent.TurnStarted("a1"))
        events.send(AgentStreamEvent.TextDelta("Hi"))
        events.send(AgentStreamEvent.TextDelta(" there"))
        advanceUntilIdle()
        assertEquals(
            listOf(
                Triple(User, "Hello", MessageStatus.Done),
                Triple(Assistant, "Hi there", MessageStatus.Streaming),
            ),
            viewModel.shown,
        )

        events.send(AgentStreamEvent.Done())
        events.close()
        advanceUntilIdle()
        assertEquals("a1", viewModel.messages.last().id)
        assertEquals(MessageStatus.Done, viewModel.messages.last().status)
        assertFalse(viewModel.turnRunning)
        assertEquals(
            Call("sendMessage", "session-1", "Hello", "openai", "gpt-4o"),
            client.calls.last(),
        )
    }

    @Test
    fun aTurnWithToolsShowsEachStepWithItsCalls() = runTest {
        client.onSendMessage = { _, _, _, _ ->
            flowOf(
                AgentStreamEvent.Started("q1"),
                AgentStreamEvent.TurnStarted("a1"),
                AgentStreamEvent.ThinkingDelta("Need the date", occurredAt = 1_000),
                AgentStreamEvent.ToolCallStarted("c1", "bash", """{"cmd":"date"}""", 2_000),
                AgentStreamEvent.ToolCallFinished("c1", "Fri", isError = false, 2_500),
                AgentStreamEvent.TurnStarted("a2"),
                AgentStreamEvent.TextDelta("It is Friday", occurredAt = 3_000),
                AgentStreamEvent.Done(occurredAt = 3_500),
            )
        }
        val viewModel = viewModel()

        send(viewModel, "What day is it?")

        val (_, toolStep, answer) = viewModel.messages
        assertEquals("Need the date", toolStep.thinking)
        assertEquals(1_000L to 2_000L, toolStep.thinkingStartedAt to toolStep.thinkingFinishedAt)
        assertEquals(
            listOf(
                UiToolCall("c1", "bash", """{"cmd":"date"}""", false, "Fri", false, 2_000, 2_500)
            ),
            toolStep.toolCalls,
        )
        assertEquals(MessageStatus.Done, toolStep.status)
        assertEquals("It is Friday" to MessageStatus.Done, answer.content to answer.status)
    }

    @Test
    fun blankInputAndASecondTurnAreIgnored() = runTest {
        client.onSendMessage = { _, _, _, _ -> flow { awaitCancellation() } }
        val viewModel = viewModel()

        send(viewModel, "  ")
        send(viewModel, "Hello")
        send(viewModel, "Again")

        assertEquals(1, client.calls.count { it.name == "sendMessage" })
        assertEquals("Again", viewModel.input)
    }

    @Test
    fun regeneratingAReplySendsItsQuestionAgainOncePerTurn() = runTest {
        client.onListSessions = { listOf(trip) }
        client.onListMessages = { _, _ ->
            ClientMessagePage(
                listOf(
                    sampleMessage("a2", "assistant", "openai", "gpt-4o"),
                    sampleMessage("q2", "user"),
                    sampleMessage("a1", "assistant", "openai", "gpt-4o"),
                    sampleMessage("q1", "user"),
                ),
                hasMore = false,
            )
        }
        client.onSendMessage = { _, _, _, _ -> flow { awaitCancellation() } }
        val viewModel = viewModel()
        open(viewModel, trip)

        viewModel.regenerate("a1")
        advanceUntilIdle()
        viewModel.regenerate("a2")
        advanceUntilIdle()

        assertEquals(
            listOf(Call("sendMessage", "trip", "q1", "openai", "gpt-4o")),
            client.calls.filter { it.name == "sendMessage" },
        )
        assertEquals(
            listOf(User, Assistant, User, Assistant, User, Assistant),
            viewModel.messages.map { it.role },
        )
    }

    @Test
    fun stoppingAbortsTheStartedTurn() = runTest {
        val events = Channel<AgentStreamEvent>(Channel.UNLIMITED)
        client.onSendMessage = { _, _, _, _ -> events.consumeAsFlow() }
        val viewModel = viewModel()
        send(viewModel, "Hello")

        viewModel.stop()
        advanceUntilIdle()
        assertFalse(client.calls.any { it.name == "abortMessage" })

        events.send(AgentStreamEvent.Started("q1"))
        advanceUntilIdle()
        viewModel.stop()
        advanceUntilIdle()
        assertEquals(Call("abortMessage", "q1"), client.calls.last())

        events.send(AgentStreamEvent.Aborted())
        events.close()
        advanceUntilIdle()
        assertEquals(MessageStatus.Aborted, viewModel.messages.last().status)
        assertFalse(viewModel.turnRunning)
    }

    @Test
    fun aFailedAbortShowsItsReason() = runTest {
        client.onSendMessage = { _, _, _, _ ->
            flow {
                emit(AgentStreamEvent.Started("q1"))
                awaitCancellation()
            }
        }
        client.onAbortMessage = { throw ServiceException(ServiceFailure.TurnNotRunning) }
        val viewModel = viewModel()
        send(viewModel, "Hello")

        viewModel.stop()
        advanceUntilIdle()

        assertEquals(errorText(ServiceFailure.TurnNotRunning), viewModel.error)
    }

    @Test
    fun anErrorEventFailsTheReplyWithItsMessage() = runTest {
        client.onSendMessage = { _, _, _, _ ->
            flowOf(AgentStreamEvent.Started("q1"), AgentStreamEvent.Error("upstream returned 500"))
        }
        val viewModel = viewModel()

        send(viewModel, "Hello")

        val reply = viewModel.messages.last()
        assertEquals(MessageStatus.Error, reply.status)
        assertEquals(UiText.Raw("upstream returned 500"), reply.error)
        assertFalse(viewModel.turnRunning)
    }

    @Test
    fun aTurnThatFailsBeforeItStartsCanBeRetried() = runTest {
        client.onSendMessage = { _, _, _, _ ->
            flow { throw ServiceException(ServiceFailure.Network) }
        }
        val viewModel = viewModel()

        send(viewModel, "Hello")

        val reply = viewModel.messages.last()
        assertEquals(MessageStatus.Error, reply.status)
        assertEquals(errorText(ServiceFailure.Network), reply.error)
        assertEquals(errorText(ServiceFailure.Network), viewModel.error)
        assertEquals("Hello", viewModel.retryText)
        assertFalse(client.calls.any { it.name == "resumeStream" })

        viewModel.retry()
        assertEquals("Hello", viewModel.input)
        assertNull(viewModel.error)
        assertNull(viewModel.retryText)
    }

    @Test
    fun aBrokenStreamResumesAfterTheEventsReceived() = runTest {
        client.onSendMessage = { _, _, _, _ ->
            flow {
                emit(AgentStreamEvent.Started("q1"))
                emit(AgentStreamEvent.TurnStarted("a1"))
                emit(AgentStreamEvent.TextDelta("Hi"))
                throw ServiceException(ServiceFailure.Network)
            }
        }
        client.onResumeStream = { _, _ ->
            flowOf(AgentStreamEvent.TextDelta(" there"), AgentStreamEvent.Done())
        }
        val viewModel = viewModel()

        send(viewModel, "Hello")

        assertEquals(
            listOf(Call("resumeStream", "q1", 3L)),
            client.calls.filter { it.name == "resumeStream" },
        )
        assertEquals(
            listOf(
                Triple(User, "Hello", MessageStatus.Done),
                Triple(Assistant, "Hi there", MessageStatus.Done),
            ),
            viewModel.shown,
        )
        assertNull(viewModel.error)
    }

    @Test
    fun resumingStopsAfterThreeBrokenStreams() = runTest {
        client.onSendMessage = { _, _, _, _ ->
            flow {
                emit(AgentStreamEvent.Started("q1"))
                throw ServiceException(ServiceFailure.Network)
            }
        }
        client.onResumeStream = { _, _ -> flow { throw ServiceException(ServiceFailure.Timeout) } }
        val viewModel = viewModel()

        send(viewModel, "Hello")

        assertEquals(3, client.calls.count { it.name == "resumeStream" })
        assertEquals(MessageStatus.Error, viewModel.messages.last().status)
        assertEquals(errorText(ServiceFailure.Timeout), viewModel.error)
        assertEquals("Hello", viewModel.retryText)
        assertFalse(viewModel.turnRunning)
    }

    @Test
    fun aTurnThatEndedWhileTheStreamWasBrokenShowsTheNewestPage() = runTest {
        client.onSendMessage = { _, _, _, _ ->
            flow {
                emit(AgentStreamEvent.Started("q1"))
                throw ServiceException(ServiceFailure.Network)
            }
        }
        val settled = listOf(sampleMessage("a1", "assistant"), sampleMessage("q1", "user"))
        client.onListMessages = { _, _ -> ClientMessagePage(settled, hasMore = false) }
        val viewModel = viewModel()

        send(viewModel, "Hello")

        assertEquals(listOf("q1", "a1"), viewModel.messages.map { it.id })
        assertEquals(settled.asReversed(), messageCache.getMessages("session-1"))
        assertNull(viewModel.error)
        assertFalse(viewModel.turnRunning)
    }

    @Test
    fun openingASessionFollowsTheTurnItIsRunning() = runTest {
        val running =
            ClientMessage(
                "a1",
                "assistant",
                "",
                status = MessageStatus.Streaming,
                providerId = "openai",
                model = "gpt-4o",
            )
        client.onListMessages = { _, _ ->
            ClientMessagePage(
                listOf(
                    running,
                    sampleMessage("q1", "user"),
                    sampleMessage("a0", "assistant"),
                    sampleMessage("q0", "user"),
                ),
                hasMore = false,
            )
        }
        val events = Channel<AgentStreamEvent>(Channel.UNLIMITED)
        client.onResumeStream = { _, _ -> events.consumeAsFlow() }
        val viewModel = viewModel()

        open(viewModel, trip)

        assertEquals(Call("resumeStream", "q1", 0L), client.calls.last())
        assertTrue(viewModel.stoppable)
        assertEquals(
            listOf(
                Triple(User, "q0", MessageStatus.Done),
                Triple(Assistant, "a0", MessageStatus.Done),
                Triple(User, "q1", MessageStatus.Done),
                Triple(Assistant, "", MessageStatus.Streaming),
            ),
            viewModel.shown,
        )

        events.send(AgentStreamEvent.Started("q1"))
        events.send(AgentStreamEvent.TurnStarted("a1"))
        events.send(AgentStreamEvent.TextDelta("Sunny"))
        events.send(AgentStreamEvent.Done())
        events.close()
        advanceUntilIdle()

        assertEquals(listOf("q0", "a0", "q1", "a1"), viewModel.messages.map { it.id })
        assertEquals(Triple(Assistant, "Sunny", MessageStatus.Done), viewModel.shown.last())
        assertFalse(viewModel.turnRunning)
    }

    @Test
    fun leavingASessionStopsFollowingItsTurn() = runTest {
        var following = false
        client.onSendMessage = { sessionId, _, _, _ ->
            if (sessionId == "trip") {
                flow {
                    emit(AgentStreamEvent.Started("q1"))
                    following = true
                    try {
                        awaitCancellation()
                    } finally {
                        following = false
                    }
                }
            } else {
                flowOf(AgentStreamEvent.Done())
            }
        }
        val viewModel = viewModel()
        open(viewModel, trip)
        send(viewModel, "Hello")
        assertTrue(following)

        open(viewModel, work)

        assertFalse(following)
        assertFalse(viewModel.turnRunning)
        assertEquals(emptyList(), viewModel.messages)
        send(viewModel, "Again")
        assertEquals(Call("sendMessage", "work", "Again", "openai", "gpt-4o"), client.calls.last())
    }

    @Test
    fun aRecreatedViewModelReopensTheSessionThatWasOpen() = runTest {
        client.onListSessions = { listOf(trip, work) }
        client.onListMessages = { sessionId, _ ->
            ClientMessagePage(listOf(sampleMessage("$sessionId-q", "user")), hasMore = false)
        }
        val state = SavedStateHandle()
        open(viewModel(state), work)

        val recreated = viewModel(state)

        assertEquals(work, recreated.currentSession)
        assertEquals(listOf("work-q"), recreated.messages.map { it.id })

        recreated.newSession()
        assertNull(viewModel(state).openSession)
    }

    @Test
    fun anOpenedSessionShowsItsCachedMessagesUntilTheServiceAnswers() = runTest {
        messageCache.replaceMessages("trip", listOf(ClientMessage("q1", "user", "cached question")))
        val page = CompletableDeferred<ClientMessagePage>()
        client.onListMessages = { _, _ -> page.await() }
        val viewModel = viewModel()

        open(viewModel, trip)
        assertEquals(listOf(Triple(User, "cached question", MessageStatus.Done)), viewModel.shown)

        val newestFirst =
            listOf(
                sampleMessage("a1", "assistant", providerId = "openai", model = "gpt-4o-mini"),
                sampleMessage("q1", "user"),
            )
        page.complete(ClientMessagePage(newestFirst, hasMore = true))
        advanceUntilIdle()

        assertEquals(listOf("q1", "a1"), viewModel.messages.map { it.content })
        assertTrue(viewModel.openSession?.hasOlderMessages == true)
        assertEquals(ModelSelection("openai", "gpt-4o-mini"), viewModel.selection)
        assertEquals(newestFirst.asReversed(), messageCache.getMessages("trip"))
    }

    @Test
    fun toolMessagesAreHiddenAndTheirResultsJoinTheCallsAcrossPages() = runTest {
        val call = ClientToolCall("c1", "bash", """{"cmd":"date"}""")
        val result =
            ClientMessage("t1", "tool", "Fri", toolResult = ClientToolResult("c1", isError = true))
        client.onListMessages = { _, beforeId ->
            if (beforeId == null) {
                ClientMessagePage(listOf(sampleMessage("a2", "assistant"), result), hasMore = true)
            } else {
                ClientMessagePage(
                    listOf(
                        ClientMessage("a1", "assistant", "", toolCalls = listOf(call)),
                        sampleMessage("q1", "user"),
                    ),
                    hasMore = false,
                )
            }
        }
        val viewModel = viewModel()
        open(viewModel, trip)

        viewModel.loadOlderMessages()
        advanceUntilIdle()

        assertEquals(listOf("q1", "a1", "a2"), viewModel.messages.map { it.id })
        assertEquals(
            listOf(UiToolCall("c1", "bash", """{"cmd":"date"}""", running = false, "Fri", true)),
            viewModel.messages[1].toolCalls,
        )
        assertEquals(Call("listMessages", "trip", "t1"), client.calls.last())
        assertEquals(listOf("q1", "a1", "t1", "a2"), messageCache.getMessages("trip").map { it.id })
    }

    @Test
    fun olderMessagesArePrependedUntilTheFirstMessage() = runTest {
        client.onListMessages = { _, beforeId ->
            if (beforeId == null) {
                ClientMessagePage(
                    listOf(sampleMessage("a2", "assistant"), sampleMessage("q2", "user")),
                    hasMore = true,
                )
            } else {
                ClientMessagePage(
                    listOf(sampleMessage("a1", "assistant"), sampleMessage("q1", "user")),
                    hasMore = false,
                )
            }
        }
        val viewModel = viewModel()
        open(viewModel, trip)

        viewModel.loadOlderMessages()
        assertTrue(viewModel.openSession?.loadingOlderMessages == true)
        viewModel.loadOlderMessages()
        advanceUntilIdle()
        viewModel.loadOlderMessages()
        advanceUntilIdle()

        assertFalse(viewModel.openSession?.loadingOlderMessages == true)
        assertFalse(viewModel.openSession?.hasOlderMessages == true)
        assertEquals(listOf("q1", "a1", "q2", "a2"), viewModel.messages.map { it.id })
        assertEquals(
            listOf(Call("listMessages", "trip", null), Call("listMessages", "trip", "q2")),
            client.calls.filter { it.name == "listMessages" },
        )
    }

    @Test
    fun aFailedOlderPageKeepsTheShownMessages() = runTest {
        client.onListMessages = { _, _ ->
            ClientMessagePage(listOf(sampleMessage("q2", "user")), hasMore = true)
        }
        val viewModel = viewModel()
        open(viewModel, trip)
        client.onListMessages = { _, _ -> throw ServiceException(ServiceFailure.Network) }

        viewModel.loadOlderMessages()
        advanceUntilIdle()

        assertEquals(errorText(ServiceFailure.Network), viewModel.error)
        assertFalse(viewModel.openSession?.loadingOlderMessages == true)
        assertTrue(viewModel.openSession?.hasOlderMessages == true)
        assertEquals(listOf("q2"), viewModel.messages.map { it.id })
    }

    @Test
    fun switchingSessionsDropsTheEarlierLoad() = runTest {
        client.onListSessions = { listOf(trip, work) }
        val tripPage = CompletableDeferred<ClientMessagePage>()
        client.onListMessages = { sessionId, _ ->
            if (sessionId == "trip") {
                tripPage.await()
            } else {
                ClientMessagePage(listOf(sampleMessage("w1", "user")), hasMore = false)
            }
        }
        val viewModel = viewModel()

        open(viewModel, trip)
        open(viewModel, work)
        tripPage.complete(ClientMessagePage(listOf(sampleMessage("t1", "user")), hasMore = false))
        advanceUntilIdle()
        open(viewModel, work)

        assertEquals(work, viewModel.currentSession)
        assertEquals(listOf("w1"), viewModel.messages.map { it.id })
        assertEquals(2, client.calls.count { it.name == "listMessages" })
    }

    @Test
    fun aNewSessionWaitsForItsFirstTurnWithTheDefaultModel() = runTest {
        settings.setModelSelection(ModelSelection("openai", "gpt-4o"))
        client.onListSessions = { listOf(trip, work) }
        client.onListMessages = { _, _ ->
            ClientMessagePage(
                listOf(
                    sampleMessage("a1", "assistant", providerId = "openai", model = "gpt-4o-mini")
                ),
                hasMore = true,
            )
        }
        val viewModel = viewModel()
        open(viewModel, trip)

        viewModel.newSession()

        assertNull(viewModel.openSession)
        assertEquals(emptyList(), viewModel.messages)
        assertEquals(ModelSelection("openai", "gpt-4o"), viewModel.selection)
        assertFalse(client.calls.any { it.name == "createSession" })
    }

    @Test
    fun renamingTrimsTheTitleAndSkipsBlankOrUnchangedOnes() = runTest {
        client.onListSessions = { listOf(trip, work) }
        val viewModel = viewModel()

        viewModel.renameSession(trip, "  Paris  ")
        viewModel.renameSession(work, "   ")
        viewModel.renameSession(work, "Work")
        advanceUntilIdle()

        assertEquals(
            listOf(Call("renameSession", "trip", "Paris")),
            client.calls.filter { it.name == "renameSession" },
        )
        assertEquals(listOf("Paris", "Work"), viewModel.sessions.map { it.title })

        client.onRenameSession = { _, _ -> throw ServiceException(ServiceFailure.SessionNotFound) }
        viewModel.renameSession(work, "Office")
        advanceUntilIdle()
        assertEquals(errorText(ServiceFailure.SessionNotFound), viewModel.error)
        assertEquals(listOf("Paris", "Work"), viewModel.sessions.map { it.title })
    }

    @Test
    fun deletingTheOpenSessionClosesItAndDropsItsCache() = runTest {
        client.onListSessions = { listOf(trip, work) }
        client.onListMessages = { _, _ ->
            ClientMessagePage(listOf(sampleMessage("q1", "user")), hasMore = false)
        }
        val viewModel = viewModel()
        open(viewModel, trip)

        client.onDeleteSession = { throw ServiceException(ServiceFailure.Network) }
        viewModel.deleteSession(trip)
        advanceUntilIdle()
        assertEquals(errorText(ServiceFailure.Network), viewModel.error)
        assertEquals(trip, viewModel.currentSession)

        client.onDeleteSession = {}
        viewModel.deleteSession(trip)
        advanceUntilIdle()

        assertEquals(listOf(work), viewModel.sessions)
        assertNull(viewModel.openSession)
        assertEquals(emptyList(), messageCache.getMessages("trip"))
    }

    @Test
    fun failedCallsShowTheirReason() = runTest {
        val viewModel = viewModel()

        client.onListProviders = { throw ServiceException(ServiceFailure.Network) }
        viewModel.loadProviders()
        advanceUntilIdle()
        assertEquals(errorText(ServiceFailure.Network), viewModel.error)
        viewModel.dismissError()
        assertNull(viewModel.error)

        client.onListSessions = { throw ServiceException(ServiceFailure.Timeout) }
        viewModel.refreshSessions()
        advanceUntilIdle()
        assertEquals(errorText(ServiceFailure.Timeout), viewModel.error)

        client.onCreateSession = { throw ServiceException(ServiceFailure.TokenInvalid) }
        send(viewModel, "Hello")
        assertEquals(errorText(ServiceFailure.TokenInvalid), viewModel.error)
        assertEquals("Hello", viewModel.retryText)
        assertFalse(viewModel.turnRunning)

        client.onListMessages = { _, _ -> throw ServiceException(ServiceFailure.SessionNotFound) }
        open(viewModel, trip)
        assertEquals(errorText(ServiceFailure.SessionNotFound), viewModel.error)
    }

    @Test
    fun sessionActionsWithoutAnOpenSessionDoNothing() = runTest {
        val viewModel = viewModel()

        viewModel.loadOlderMessages()
        viewModel.stop()
        viewModel.regenerate("a1")
        viewModel.newSession()
        viewModel.retry()
        advanceUntilIdle()

        assertEquals(listOf(Call("listSessions"), Call("listProviders")), client.calls)
        assertEquals("", viewModel.input)
        assertNull(viewModel.currentSession)
    }

    @Test
    fun regeneratingNeedsAModelAndAnEarlierQuestion() = runTest {
        client.onListProviders = { emptyList() }
        client.onListMessages = { _, _ ->
            ClientMessagePage(listOf(sampleMessage("a1", "assistant")), hasMore = true)
        }
        val viewModel = viewModel()
        open(viewModel, trip)

        viewModel.regenerate("a1")
        viewModel.selectModel(ModelSelection("openai", "gpt-4o"))
        viewModel.regenerate("a1")
        viewModel.stop()
        advanceUntilIdle()

        assertNull(viewModel.currentSession)
        assertFalse(client.calls.any { it.name == "sendMessage" || it.name == "abortMessage" })
    }

    @Test
    fun regeneratingALaterStepResendsTheQuestionOfItsTurn() = runTest {
        client.onListMessages = { _, _ ->
            ClientMessagePage(
                listOf(
                    sampleMessage("a2", "assistant", "openai", "gpt-4o"),
                    sampleMessage("a1", "assistant", "openai", "gpt-4o"),
                    sampleMessage("q1", "user"),
                ),
                hasMore = false,
            )
        }
        client.onSendMessage = { _, _, _, _ -> flow { awaitCancellation() } }
        val viewModel = viewModel()
        open(viewModel, trip)

        viewModel.regenerate("a2")
        advanceUntilIdle()

        assertEquals(Call("sendMessage", "trip", "q1", "openai", "gpt-4o"), client.calls.last())
    }

    @Test
    fun anEmptySessionHasNoOlderPage() = runTest {
        val viewModel = viewModel()
        open(viewModel, trip)

        viewModel.loadOlderMessages()
        advanceUntilIdle()

        assertEquals(1, client.calls.count { it.name == "listMessages" })
    }

    @Test
    fun aTurnSentWhileTheSessionLoadsFollowsOnlyItsOwnStream() = runTest {
        val page = CompletableDeferred<ClientMessagePage>()
        client.onListMessages = { _, _ -> page.await() }
        val viewModel = viewModel()
        open(viewModel, trip)

        send(viewModel, "Hello")
        page.complete(
            ClientMessagePage(
                listOf(
                    ClientMessage("a0", "assistant", "", status = MessageStatus.Streaming),
                    sampleMessage("q0", "user"),
                ),
                hasMore = false,
            )
        )
        advanceUntilIdle()

        assertFalse(client.calls.any { it.name == "resumeStream" })
        assertEquals(Call("sendMessage", "trip", "Hello", "openai", "gpt-4o"), client.calls.last())
    }

    @Test
    fun aRunningTurnWithoutItsModelIsFollowed() = runTest {
        client.onListMessages = { _, _ ->
            ClientMessagePage(
                listOf(
                    ClientMessage("a1", "assistant", "", status = MessageStatus.Streaming),
                    sampleMessage("q1", "user"),
                ),
                hasMore = false,
            )
        }
        client.onResumeStream = { _, _ -> flow { awaitCancellation() } }
        val viewModel = viewModel()

        open(viewModel, trip)

        assertEquals(Call("resumeStream", "q1", 0L), client.calls.last())
        assertTrue(viewModel.turnRunning)
        assertEquals(Triple(Assistant, "", MessageStatus.Streaming), viewModel.shown.last())
    }

    @Test
    fun aFailedReloadAfterAnEndedTurnShowsItsReason() = runTest {
        client.onSendMessage = { _, _, _, _ ->
            flow {
                emit(AgentStreamEvent.Started("q1"))
                throw ServiceException(ServiceFailure.Network)
            }
        }
        client.onListMessages = { _, _ -> throw ServiceException(ServiceFailure.Timeout) }
        val viewModel = viewModel()

        send(viewModel, "Hello")

        assertEquals(errorText(ServiceFailure.Timeout), viewModel.error)
        assertFalse(viewModel.turnRunning)
    }
}
