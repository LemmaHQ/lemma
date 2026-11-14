package dev.lemmahq.lemma.ui.session

import androidx.lifecycle.SavedStateHandle
import com.russhwolf.settings.MapSettings
import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.ClientMessage
import dev.lemmahq.lemma.client.ClientMessageTree
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
import dev.lemmahq.lemma.data.ModelSelection
import dev.lemmahq.lemma.data.SettingsRepository
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
import lemma.mobile.shared.generated.resources.errors_model_required

@OptIn(ExperimentalCoroutinesApi::class)
class SessionViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val openai = sampleProvider("openai", "gpt-4o", "gpt-4o-mini")
    private val client = FakeLemmaClient().apply { onListProviders = { listOf(openai) } }
    private val settings = SettingsRepository(MapSettings())
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
        SessionViewModel(client, settings, state).also {
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
        val viewModel = SessionViewModel(client, settings, SavedStateHandle())
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

        client.onListProviders = { listOf(sampleProvider("openai", "gpt-4o-mini")) }
        viewModel.loadProviders()
        advanceUntilIdle()
        assertEquals(ModelSelection("openai", "gpt-4o-mini"), viewModel.selection)
    }

    @Test
    fun sendingWithoutAModelAsksForOne() = runTest {
        client.onListProviders = { emptyList() }
        val viewModel = viewModel()

        send(viewModel, "Hello")

        assertEquals(UiText.Resource(Res.string.errors_model_required), viewModel.error)
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
        client.onListMessages = {
            ClientMessageTree(
                listOf(
                    sampleMessage("q1", "user"),
                    sampleMessage("a1", "assistant", "openai", "gpt-4o", parentId = "q1"),
                    sampleMessage("q2", "user", parentId = "a1"),
                    sampleMessage("a2", "assistant", "openai", "gpt-4o", parentId = "q2"),
                ),
                leafId = "a2",
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
    fun aTurnThatEndedWhileTheStreamWasBrokenReloadsTheTree() = runTest {
        client.onSendMessage = { _, _, _, _ ->
            flow {
                emit(AgentStreamEvent.Started("q1"))
                throw ServiceException(ServiceFailure.Network)
            }
        }
        val settled =
            listOf(sampleMessage("q1", "user"), sampleMessage("a1", "assistant", parentId = "q1"))
        client.onListMessages = { ClientMessageTree(settled, leafId = "a1") }
        val viewModel = viewModel()

        send(viewModel, "Hello")

        assertEquals(listOf("q1", "a1"), viewModel.messages.map { it.id })
        assertNull(viewModel.error)
        assertFalse(viewModel.turnRunning)
    }

    @Test
    fun openingASessionFollowsTheTurnItIsRunning() = runTest {
        client.onListMessages = { runningMultiStepTree() }
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
        events.send(AgentStreamEvent.TurnStarted("a05"))
        events.send(AgentStreamEvent.ToolCallStarted("c1", "bash", "{}"))
        events.send(AgentStreamEvent.ToolCallFinished("c1", "ok", isError = false))
        events.send(AgentStreamEvent.TurnStarted("a1"))
        events.send(AgentStreamEvent.TextDelta("Sunny"))
        events.send(AgentStreamEvent.Done())
        events.close()
        advanceUntilIdle()

        assertEquals(listOf("q0", "a0", "q1", "a05", "a1"), viewModel.messages.map { it.id })
        assertEquals(Triple(Assistant, "Sunny", MessageStatus.Done), viewModel.shown.last())
        assertFalse(viewModel.turnRunning)
    }

    private fun runningMultiStepTree(): ClientMessageTree {
        val toolStep =
            ClientMessage(
                "a05",
                "assistant",
                "",
                providerId = "openai",
                model = "gpt-4o",
                toolCalls = listOf(ClientToolCall("c1", "bash", "{}")),
                parentId = "q1",
            )
        val toolOut =
            ClientMessage(
                "t1",
                "tool",
                "ok",
                toolResult = ClientToolResult("c1", isError = false),
                parentId = "a05",
            )
        val running =
            ClientMessage(
                "a1",
                "assistant",
                "",
                status = MessageStatus.Streaming,
                providerId = "openai",
                model = "gpt-4o",
                parentId = "t1",
            )
        return ClientMessageTree(
            listOf(
                sampleMessage("q0", "user"),
                sampleMessage("a0", "assistant", parentId = "q0"),
                sampleMessage("q1", "user", parentId = "a0"),
                toolStep,
                toolOut,
                running,
            ),
            leafId = "a1",
            activeMessageId = "q1",
        )
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
        client.onListMessages = { sessionId ->
            ClientMessageTree(
                listOf(sampleMessage("$sessionId-q", "user")),
                leafId = "$sessionId-q",
            )
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
    fun openingASessionSelectsItsLastUsedModelFromTheActivePath() = runTest {
        val tree = CompletableDeferred<ClientMessageTree>()
        client.onListMessages = { tree.await() }
        val viewModel = viewModel()

        open(viewModel, trip)
        assertEquals(emptyList(), viewModel.shown)

        val messages =
            listOf(
                sampleMessage("q1", "user"),
                sampleMessage(
                    "a1",
                    "assistant",
                    providerId = "openai",
                    model = "gpt-4o-mini",
                    parentId = "q1",
                ),
                sampleMessage(
                    "a2",
                    "assistant",
                    providerId = "openai",
                    model = "gpt-4o",
                    parentId = "q1",
                ),
            )
        tree.complete(ClientMessageTree(messages, leafId = "a1"))
        advanceUntilIdle()

        assertEquals(listOf("q1", "a1"), viewModel.messages.map { it.content })
        assertEquals(ModelSelection("openai", "gpt-4o-mini"), viewModel.selection)
    }

    @Test
    fun toolMessagesAreHiddenAndTheirResultsJoinTheCallsAlongTheActivePath() = runTest {
        val call = ClientToolCall("c1", "bash", """{"cmd":"date"}""")
        val q1 = sampleMessage("q1", "user")
        val a1 = ClientMessage("a1", "assistant", "", toolCalls = listOf(call), parentId = "q1")
        val result =
            ClientMessage(
                "t1",
                "tool",
                "Fri",
                toolResult = ClientToolResult("c1", isError = true),
                parentId = "a1",
            )
        val a2 = sampleMessage("a2", "assistant", parentId = "t1")
        client.onListMessages = { ClientMessageTree(listOf(q1, a1, result, a2), leafId = "a2") }
        val viewModel = viewModel()
        open(viewModel, trip)

        assertEquals(listOf("q1", "a1", "a2"), viewModel.messages.map { it.id })
        assertEquals(
            listOf(UiToolCall("c1", "bash", """{"cmd":"date"}""", running = false, "Fri", true)),
            viewModel.messages[1].toolCalls,
        )
    }

    @Test
    fun activeMessageIdResumesEvenBeforeAssistantReplyAndIgnoresOtherBranches() = runTest {
        val q1 = sampleMessage("q1", "user")
        val q2 = sampleMessage("q2", "user")
        client.onListMessages = {
            ClientMessageTree(listOf(q1, q2), leafId = "q1", activeMessageId = "q2")
        }
        val viewModel = viewModel()
        open(viewModel, trip)
        assertFalse(client.calls.any { it.name == "resumeStream" })
        assertFalse(viewModel.turnRunning)

        client.onListMessages = {
            ClientMessageTree(listOf(q1, q2), leafId = "q1", activeMessageId = "q1")
        }
        client.onResumeStream = { _, _ -> flow { awaitCancellation() } }
        open(viewModel, work)

        assertEquals(Call("resumeStream", "q1", 0L), client.calls.last())
        assertTrue(viewModel.turnRunning)
        assertEquals(Triple(Assistant, "", MessageStatus.Streaming), viewModel.shown.last())
    }

    @Test
    fun switchingSessionsDropsTheEarlierLoad() = runTest {
        client.onListSessions = { listOf(trip, work) }
        val tripTree = CompletableDeferred<ClientMessageTree>()
        client.onListMessages = { sessionId ->
            if (sessionId == "trip") {
                tripTree.await()
            } else {
                ClientMessageTree(listOf(sampleMessage("w1", "user")), leafId = "w1")
            }
        }
        val viewModel = viewModel()

        open(viewModel, trip)
        open(viewModel, work)
        tripTree.complete(ClientMessageTree(listOf(sampleMessage("t1", "user")), leafId = "t1"))
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
        client.onListMessages = {
            ClientMessageTree(
                listOf(
                    sampleMessage("a1", "assistant", providerId = "openai", model = "gpt-4o-mini")
                ),
                leafId = "a1",
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
    fun deletingTheOpenSessionClosesIt() = runTest {
        client.onListSessions = { listOf(trip, work) }
        client.onListMessages = {
            ClientMessageTree(listOf(sampleMessage("q1", "user")), leafId = "q1")
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

        client.onCreateSession = { throw ServiceException(ServiceFailure.SessionNotFound) }
        send(viewModel, "Hello")
        assertEquals(errorText(ServiceFailure.SessionNotFound), viewModel.error)
        assertEquals("Hello", viewModel.retryText)
        assertFalse(viewModel.turnRunning)

        client.onListMessages = { throw ServiceException(ServiceFailure.SessionNotFound) }
        open(viewModel, trip)
        assertEquals(errorText(ServiceFailure.SessionNotFound), viewModel.error)
    }

    @Test
    fun sessionActionsWithoutAnOpenSessionDoNothing() = runTest {
        val viewModel = viewModel()

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
        client.onListMessages = {
            ClientMessageTree(listOf(sampleMessage("a1", "assistant")), leafId = "a1")
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
        client.onListMessages = {
            ClientMessageTree(
                listOf(
                    sampleMessage("q1", "user"),
                    sampleMessage("a1", "assistant", "openai", "gpt-4o", parentId = "q1"),
                    sampleMessage("a2", "assistant", "openai", "gpt-4o", parentId = "a1"),
                ),
                leafId = "a2",
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
    fun aTurnSentWhileTheSessionLoadsFollowsOnlyItsOwnStream() = runTest {
        val tree = CompletableDeferred<ClientMessageTree>()
        client.onListMessages = { tree.await() }
        val viewModel = viewModel()
        open(viewModel, trip)

        send(viewModel, "Hello")
        tree.complete(
            ClientMessageTree(
                listOf(
                    sampleMessage("q0", "user"),
                    ClientMessage(
                        "a0",
                        "assistant",
                        "",
                        status = MessageStatus.Streaming,
                        parentId = "q0",
                    ),
                ),
                leafId = "a0",
                activeMessageId = "q0",
            )
        )
        advanceUntilIdle()

        assertFalse(client.calls.any { it.name == "resumeStream" })
        assertEquals(Call("sendMessage", "trip", "Hello", "openai", "gpt-4o"), client.calls.last())
    }

    @Test
    fun aRunningTurnWithoutItsModelIsFollowed() = runTest {
        client.onListMessages = {
            ClientMessageTree(
                listOf(
                    sampleMessage("q1", "user"),
                    ClientMessage(
                        "a1",
                        "assistant",
                        "",
                        status = MessageStatus.Streaming,
                        parentId = "q1",
                    ),
                ),
                leafId = "a1",
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
        client.onListMessages = { throw ServiceException(ServiceFailure.Timeout) }
        val viewModel = viewModel()

        send(viewModel, "Hello")

        assertEquals(errorText(ServiceFailure.Timeout), viewModel.error)
        assertFalse(viewModel.turnRunning)
    }
}
