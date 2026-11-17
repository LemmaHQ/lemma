package dev.lemmahq.lemma.ui.agent

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
import dev.lemmahq.lemma.ui.agent.MessageRole.Assistant
import dev.lemmahq.lemma.ui.agent.MessageRole.User
import dev.lemmahq.lemma.ui.session.SessionListViewModel
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Clock
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.consumeAsFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.errors_model_required

@OptIn(ExperimentalCoroutinesApi::class)
class AgentViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private val openai = sampleProvider("openai", "gpt-4o", "gpt-4o-mini")
    private val client = FakeLemmaClient().apply { onListProviders = { listOf(openai) } }
    private val settings = SettingsRepository(MapSettings())
    private val trip = sampleSession("trip", "Trip")
    private val work = sampleSession("work", "Work")
    private lateinit var sessions: SessionListViewModel

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun TestScope.viewModel(state: SavedStateHandle = SavedStateHandle()) =
        AgentViewModel(client, settings, state).also {
            sessions = SessionListViewModel(client, it)
            it.loadProviders()
            advanceUntilIdle()
        }

    private val AgentViewModel.shown
        get() = messages.map { Triple(it.role, it.content, it.status) }

    private fun TestScope.send(viewModel: AgentViewModel, text: String) {
        viewModel.changeInput(text)
        viewModel.send(sessions::createSession)
        advanceUntilIdle()
    }

    private fun TestScope.open(viewModel: AgentViewModel, session: ClientSession) {
        viewModel.selectSession(session)
        advanceUntilIdle()
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
        client.onSendMessage = { _, _, _, _, _ -> events.consumeAsFlow() }
        val viewModel = viewModel()

        viewModel.changeInput("  Hello  ")
        viewModel.send(sessions::createSession)
        assertEquals("  Hello  ", viewModel.input)
        assertTrue(viewModel.turnRunning)
        events.send(AgentStreamEvent.Started("q1"))
        advanceUntilIdle()
        assertEquals("", viewModel.input)
        assertEquals(sampleSession("session-1", ""), sessions.currentSession)
        assertEquals(listOf(sampleSession("session-1", "")), sessions.sessions)

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

        client.onListMessages = {
            ClientMessageTree(
                listOf(
                    ClientMessage("q1", "user", "Hello"),
                    ClientMessage("a1", "assistant", "Hi there", parentId = "q1"),
                ),
                leafId = "a1",
            )
        }
        events.send(AgentStreamEvent.Done())
        events.close()
        advanceUntilIdle()
        assertEquals(listOf("q1", "a1"), viewModel.messages.map { it.id })
        assertEquals(MessageStatus.Done, viewModel.messages.last().status)
        assertFalse(viewModel.turnRunning)
        assertEquals(
            listOf(
                Call("sendMessage", "session-1", "Hello", "openai", "gpt-4o", null),
                Call("listMessages", "session-1"),
            ),
            client.calls.takeLast(2),
        )
    }

    @Test
    fun aTurnWithToolsShowsEachStepWithItsCalls() = runTest {
        client.onSendMessage = { _, _, _, _, _ ->
            flow {
                emit(AgentStreamEvent.Started("q1"))
                emit(AgentStreamEvent.TurnStarted("a1"))
                emit(AgentStreamEvent.ThinkingDelta("Need the date", occurredAt = 1_000))
                emit(AgentStreamEvent.ToolCallStarted("c1", "bash", """{"cmd":"date"}""", 2_000))
                emit(AgentStreamEvent.ToolCallFinished("c1", "Fri", isError = false, 2_500))
                emit(AgentStreamEvent.TurnStarted("a2"))
                emit(AgentStreamEvent.TextDelta("It is Friday", occurredAt = 3_000))
                awaitCancellation()
            }
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
        assertEquals("It is Friday" to MessageStatus.Streaming, answer.content to answer.status)
    }

    @Test
    fun blankInputAndASecondTurnAreIgnored() = runTest {
        client.onSendMessage = { _, _, _, _, _ -> flow { awaitCancellation() } }
        val viewModel = viewModel()

        send(viewModel, "  ")
        send(viewModel, "Hello")
        send(viewModel, "Again")

        assertEquals(1, client.calls.count { it.name == "sendMessage" })
        assertEquals("Again", viewModel.input)
    }

    @Test
    fun regeneratingAReplyBranchesItsQuestionUnderTheSameParentOncePerTurn() = runTest {
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
        client.onSendMessage = { _, _, _, _, _ ->
            flow {
                emit(AgentStreamEvent.Started("q3"))
                emit(AgentStreamEvent.TurnStarted("a3"))
                emit(AgentStreamEvent.TextDelta("again"))
                awaitCancellation()
            }
        }
        val viewModel = viewModel()
        open(viewModel, trip)

        viewModel.regenerate("a2")
        advanceUntilIdle()
        viewModel.regenerate("a1")
        advanceUntilIdle()

        assertEquals(
            listOf(Call("sendMessage", "trip", "q2", "openai", "gpt-4o", "a1")),
            client.calls.filter { it.name == "sendMessage" },
        )
        assertEquals(listOf("q1", "a1", "q2", "again"), viewModel.messages.map { it.content })
    }

    @Test
    fun stoppingAbortsTheStartedTurn() = runTest {
        val events = Channel<AgentStreamEvent>(Channel.UNLIMITED)
        client.onSendMessage = { _, _, _, _, _ -> events.consumeAsFlow() }
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
        advanceUntilIdle()
        assertEquals(MessageStatus.Aborted, viewModel.messages.last().status)
        events.close()
        advanceUntilIdle()
        assertFalse(viewModel.turnRunning)
    }

    @Test
    fun aFailedAbortShowsItsReason() = runTest {
        client.onSendMessage = { _, _, _, _, _ ->
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
        client.onSendMessage = { _, _, _, _, _ ->
            flowOf(AgentStreamEvent.Started("q1"), AgentStreamEvent.Error("upstream returned 500"))
        }
        client.onListMessages = {
            ClientMessageTree(
                listOf(
                    ClientMessage("q1", "user", "Hello"),
                    ClientMessage(
                        "a1",
                        "assistant",
                        "",
                        status = MessageStatus.Error,
                        error = "upstream returned 500",
                        parentId = "q1",
                    ),
                ),
                leafId = "a1",
            )
        }
        val viewModel = viewModel()

        send(viewModel, "Hello")

        val reply = viewModel.messages.last()
        assertEquals(MessageStatus.Error, reply.status)
        assertEquals(UiText.Raw("upstream returned 500"), reply.error)
        assertFalse(viewModel.turnRunning)
    }

    @Test
    fun aTurnThatFailsBeforeItStartsDocksItsFailureAndIsRetriedAsANewRootBranch() = runTest {
        client.onSendMessage = { _, _, _, _, _ ->
            flow { throw ServiceException(ServiceFailure.Network) }
        }
        val viewModel = viewModel()

        send(viewModel, "Hello")

        val reply = viewModel.messages.last()
        assertEquals(MessageStatus.Error, reply.status)
        assertEquals(errorText(ServiceFailure.Network), reply.error)
        assertEquals(reply, viewModel.turnFailure)
        assertNull(viewModel.error)
        assertFalse(client.calls.any { it.name == "resumeStream" })

        client.onSendMessage = { _, _, _, _, _ ->
            flowOf(AgentStreamEvent.Started("q2"), AgentStreamEvent.Done())
        }
        client.onListMessages = {
            ClientMessageTree(
                listOf(
                    ClientMessage("q2", "user", "Hello"),
                    ClientMessage("a2", "assistant", "", parentId = "q2"),
                ),
                leafId = "a2",
            )
        }
        viewModel.retry()
        assertNull(viewModel.turnFailure)
        advanceUntilIdle()

        assertEquals(
            Call("sendMessage", "session-1", "Hello", "openai", "gpt-4o", ""),
            client.calls.last { it.name == "sendMessage" },
        )
        assertEquals(
            listOf(
                Triple(User, "Hello", MessageStatus.Done),
                Triple(Assistant, "", MessageStatus.Done),
            ),
            viewModel.shown,
        )
        assertNull(viewModel.turnFailure)
    }

    @Test
    fun aFailedReplyIsRetriedWithTheSelectedModelAsASiblingOfItsQuestion() = runTest {
        client.onListMessages = {
            ClientMessageTree(
                listOf(
                    sampleMessage("q1", "user"),
                    sampleMessage("a1", "assistant", "openai", "gpt-4o", parentId = "q1"),
                    sampleMessage("q2", "user", parentId = "a1"),
                    ClientMessage(
                        "a2",
                        "assistant",
                        "",
                        status = MessageStatus.Error,
                        error = "upstream returned 500",
                        providerId = "openai",
                        model = "gpt-4o",
                        parentId = "q2",
                    ),
                ),
                leafId = "a2",
            )
        }
        client.onSendMessage = { _, _, _, _, _ -> flow { awaitCancellation() } }
        val viewModel = viewModel()
        open(viewModel, trip)
        assertEquals(UiText.Raw("upstream returned 500"), viewModel.turnFailure?.error)

        viewModel.selectModel(ModelSelection("openai", "gpt-4o-mini"))
        viewModel.retry()
        advanceUntilIdle()

        assertEquals(
            Call("sendMessage", "trip", "q2", "openai", "gpt-4o-mini", "a1"),
            client.calls.last(),
        )
        assertEquals(listOf("q1", "a1", "q2", ""), viewModel.messages.map { it.content })
        assertNull(viewModel.turnFailure)
    }

    @Test
    fun aBrokenStreamResumesAfterTheEventsReceived() = runTest {
        client.onSendMessage = { _, _, _, _, _ ->
            flow {
                emit(AgentStreamEvent.Started("q1"))
                emit(AgentStreamEvent.TurnStarted("a1"))
                emit(AgentStreamEvent.TextDelta("Hi"))
                throw ServiceException(ServiceFailure.Network)
            }
        }
        val resumed = Channel<AgentStreamEvent>(Channel.UNLIMITED)
        client.onResumeStream = { _, _ -> resumed.consumeAsFlow() }
        val viewModel = viewModel()

        send(viewModel, "Hello")
        assertEquals(3L, viewModel.reconnectOffset)
        resumed.send(AgentStreamEvent.TextDelta(" there"))
        advanceUntilIdle()
        assertNull(viewModel.reconnectOffset)
        assertEquals("Hi there", viewModel.messages.last().content)
        client.onListMessages = {
            ClientMessageTree(
                listOf(
                    ClientMessage("q1", "user", "Hello"),
                    ClientMessage("a1", "assistant", "Hi there", parentId = "q1"),
                ),
                leafId = "a1",
            )
        }
        resumed.send(AgentStreamEvent.Done())
        resumed.close()
        advanceUntilIdle()

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
        client.onSendMessage = { _, _, _, _, _ ->
            flow {
                emit(AgentStreamEvent.Started("q1"))
                throw ServiceException(ServiceFailure.Network)
            }
        }
        client.onResumeStream = { _, _ -> flow { throw ServiceException(ServiceFailure.Timeout) } }
        val viewModel = viewModel()

        send(viewModel, "Hello")

        assertEquals(3, client.calls.count { it.name == "resumeStream" })
        assertEquals(errorText(ServiceFailure.Timeout), viewModel.turnFailure?.error)
        assertNull(viewModel.error)
        assertNull(viewModel.reconnectOffset)
        assertFalse(viewModel.turnRunning)
    }

    @Test
    fun aTurnThatEndedWhileTheStreamWasBrokenReloadsTheTree() = runTest {
        client.onSendMessage = { _, _, _, _, _ ->
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
        assertTrue(viewModel.turnRunning)
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
        advanceUntilIdle()
        assertEquals(listOf("q0", "a0", "q1", "a05", "a1"), viewModel.messages.map { it.id })

        client.onListMessages = {
            runningMultiStepTree().let { tree ->
                tree.copy(
                    messages =
                        tree.messages.map {
                            if (it.id == "a1") {
                                it.copy(content = "Sunny", status = MessageStatus.Done)
                            } else {
                                it
                            }
                        },
                    activeMessageId = null,
                )
            }
        }
        events.send(AgentStreamEvent.Done())
        events.close()
        advanceUntilIdle()

        assertEquals(listOf("q0", "a0", "q1", "a05", "a1"), viewModel.messages.map { it.id })
        assertEquals(Triple(Assistant, "Sunny", MessageStatus.Done), viewModel.shown.last())
        assertEquals(
            listOf(UiToolCall("c1", "bash", "{}", running = false, "ok", false)),
            viewModel.messages[3].toolCalls,
        )
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
    fun aRunningTurnBetweenToolAndReplyKeepsTheModelOfItsLastStep() = runTest {
        client.onListMessages = {
            runningMultiStepTree().let { tree ->
                tree.copy(messages = tree.messages.filter { it.id != "a1" }, leafId = "t1")
            }
        }
        client.onResumeStream = { _, _ -> flow { awaitCancellation() } }
        val viewModel = viewModel()

        open(viewModel, trip)

        assertEquals(Call("resumeStream", "q1", 0L), client.calls.last())
        val reply = viewModel.messages.last()
        assertEquals(MessageStatus.Streaming, reply.status)
        assertEquals("openai" to "gpt-4o", reply.providerId to reply.model)
    }

    @Test
    fun leavingASessionStopsFollowingItsTurn() = runTest {
        var following = false
        client.onSendMessage = { sessionId, _, _, _, _ ->
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
        assertEquals(
            Call("sendMessage", "work", "Again", "openai", "gpt-4o", null),
            client.calls.last { it.name == "sendMessage" },
        )
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

        assertEquals(work, sessions.currentSession)
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

        assertEquals(work, sessions.currentSession)
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
    fun failedCallsShowTheirReason() = runTest {
        val viewModel = viewModel()

        client.onListProviders = { throw ServiceException(ServiceFailure.Network) }
        viewModel.loadProviders()
        advanceUntilIdle()
        assertEquals(errorText(ServiceFailure.Network), viewModel.error)
        viewModel.dismissError()
        assertNull(viewModel.error)

        client.onListSessions = { throw ServiceException(ServiceFailure.Timeout) }
        sessions.refreshSessions()
        advanceUntilIdle()
        assertEquals(errorText(ServiceFailure.Timeout), viewModel.error)

        client.onCreateSession = { throw ServiceException(ServiceFailure.SessionNotFound) }
        send(viewModel, "Hello")
        assertEquals(errorText(ServiceFailure.SessionNotFound), viewModel.error)
        assertEquals("Hello", viewModel.input)
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
        assertNull(sessions.currentSession)
        assertNull(viewModel.turnFailure)
        assertNull(viewModel.reconnectOffset)
        assertNull(viewModel.turnStartedAt)
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

        assertNull(sessions.currentSession)
        assertFalse(client.calls.any { it.name == "sendMessage" || it.name == "abortMessage" })
    }

    @Test
    fun regeneratingALaterStepBranchesTheQuestionOfItsTurn() = runTest {
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
        client.onSendMessage = { _, _, _, _, _ -> flow { awaitCancellation() } }
        val viewModel = viewModel()
        open(viewModel, trip)

        viewModel.regenerate("a2")
        advanceUntilIdle()

        assertEquals(Call("sendMessage", "trip", "q1", "openai", "gpt-4o", ""), client.calls.last())
        assertEquals(listOf(User, Assistant), viewModel.messages.map { it.role })
        assertEquals("q1", viewModel.messages.first().content)
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
        assertEquals(
            Call("sendMessage", "trip", "Hello", "openai", "gpt-4o", null),
            client.calls.last { it.name == "sendMessage" },
        )
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
        val before = Clock.System.now().toEpochMilliseconds()

        open(viewModel, trip)

        assertEquals(Call("resumeStream", "q1", 0L), client.calls.last())
        assertTrue(viewModel.turnRunning)
        assertEquals(Triple(Assistant, "", MessageStatus.Streaming), viewModel.shown.last())
        val startedAt = assertNotNull(viewModel.turnStartedAt)
        assertTrue(startedAt in before..Clock.System.now().toEpochMilliseconds())
    }

    @Test
    fun aFollowedTurnStartsWhenTheServiceRecordedItsQuestion() = runTest {
        client.onListMessages = {
            ClientMessageTree(
                listOf(
                    sampleMessage("q1", "user").copy(createdAt = 1_000L),
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

        assertEquals(1_000L, viewModel.turnStartedAt)
    }

    @Test
    fun aFailedReloadAfterAnEndedTurnShowsItsReason() = runTest {
        client.onSendMessage = { _, _, _, _, _ ->
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

    @Test
    fun turnsReportTheirStartAndEndButNoEndOnceTheirSessionCloses() = runTest {
        val viewModel = viewModel()
        val turns = mutableListOf<SessionTurn>()
        backgroundScope.launch { viewModel.turns.collect(turns::add) }
        advanceUntilIdle()

        send(viewModel, "Hello")
        client.onSendMessage = { _, _, _, _, _ -> flow { awaitCancellation() } }
        send(viewModel, "Again")
        viewModel.newSession()
        advanceUntilIdle()

        assertEquals(
            listOf(
                SessionTurn("session-1", TurnState.Running),
                SessionTurn("session-1", TurnState.Done),
                SessionTurn("session-1", TurnState.Running),
            ),
            turns,
        )
    }

    private fun forkedTree() =
        ClientMessageTree(
            listOf(
                sampleMessage("q1", "user"),
                sampleMessage("a1", "assistant", parentId = "q1"),
                sampleMessage("q2", "user", parentId = "a1"),
                sampleMessage("a2", "assistant", parentId = "q2"),
                sampleMessage("q3", "user", parentId = "a1"),
                sampleMessage("a3", "assistant", parentId = "q3"),
            ),
            leafId = "a3",
        )

    private val AgentViewModel.shownIds
        get() = messages.map { it.id }

    @Test
    fun theTreeListsEveryBranchAndSwitchingShowsAPathOnceTheServiceMovedIt() = runTest {
        client.onListMessages = { forkedTree() }
        val viewModel = viewModel()
        open(viewModel, trip)

        val tree = assertNotNull(viewModel.sessionTree)
        assertEquals(2, tree.pathCount)
        assertEquals(listOf("q1", "a1", "q3", "a3", "q2", "a2"), tree.rows.map { it.id })

        viewModel.switchLeaf("a2")
        advanceUntilIdle()

        assertEquals(Call("setSessionLeaf", "trip", "a2"), client.calls.last())
        assertEquals(listOf("q1", "a1", "q2", "a2"), viewModel.shownIds)
        assertEquals(
            listOf("q1", "a1", "q2", "a2", "q3", "a3"),
            viewModel.sessionTree?.rows?.map { it.id },
        )

        client.onSetSessionLeaf = { _, _ -> throw ServiceException(ServiceFailure.SessionNotFound) }
        viewModel.switchLeaf("a3")
        advanceUntilIdle()

        assertEquals(errorText(ServiceFailure.SessionNotFound), viewModel.error)
        assertEquals(listOf("q1", "a1", "q2", "a2"), viewModel.shownIds)
    }

    @Test
    fun rewindingShowsThePathBeforeTheQuestionAndRestoringBringsBackThePathAndDraft() = runTest {
        client.onListMessages = { forkedTree() }
        val viewModel = viewModel()
        open(viewModel, trip)
        viewModel.changeInput("draft")

        viewModel.rewind("unknown")
        assertFalse(viewModel.rewinding)
        assertEquals("draft", viewModel.input)

        viewModel.rewind("q3")
        assertTrue(viewModel.rewinding)
        assertEquals("q3", viewModel.input)
        assertEquals(listOf("q1", "a1"), viewModel.shownIds)

        viewModel.changeInput("edited")
        viewModel.rewind("q1")
        assertEquals("q1", viewModel.input)
        assertEquals(emptyList(), viewModel.shownIds)

        viewModel.cancelRewind()
        assertFalse(viewModel.rewinding)
        assertEquals("draft", viewModel.input)
        assertEquals(listOf("q1", "a1", "q3", "a3"), viewModel.shownIds)

        viewModel.changeInput("later")
        viewModel.cancelRewind()
        assertEquals("later", viewModel.input)
        assertFalse(client.calls.any { it.name == "setSessionLeaf" })
    }

    @Test
    fun aTurnSentDuringARewindBranchesBesideTheRewoundQuestion() = runTest {
        client.onListMessages = { forkedTree() }
        client.onSendMessage = { _, _, _, _, _ -> flow { awaitCancellation() } }
        val viewModel = viewModel()
        open(viewModel, trip)

        viewModel.rewind("q3")
        viewModel.changeInput("q3 again")
        viewModel.send(sessions::createSession)
        assertFalse(viewModel.rewinding)
        advanceUntilIdle()

        assertEquals(
            Call("sendMessage", "trip", "q3 again", "openai", "gpt-4o", "a1"),
            client.calls.last(),
        )
        assertEquals(listOf("q1", "a1", "q3 again", ""), viewModel.messages.map { it.content })
        assertEquals(3, viewModel.sessionTree?.pathCount)
    }

    @Test
    fun aTurnSentDuringARewindOfARootQuestionStartsANewRootBranch() = runTest {
        client.onListMessages = { forkedTree() }
        client.onSendMessage = { _, _, _, _, _ -> flow { awaitCancellation() } }
        val viewModel = viewModel()
        open(viewModel, trip)

        viewModel.rewind("q1")
        send(viewModel, "fresh")

        assertEquals(
            Call("sendMessage", "trip", "fresh", "openai", "gpt-4o", ""),
            client.calls.last(),
        )
        assertEquals(listOf("fresh", ""), viewModel.messages.map { it.content })
    }

    @Test
    fun switchingThePathEndsARewindWithoutRestoringTheDraft() = runTest {
        client.onListMessages = { forkedTree() }
        val viewModel = viewModel()
        open(viewModel, trip)
        viewModel.changeInput("draft")

        viewModel.rewind("q3")
        viewModel.switchLeaf("a2")
        advanceUntilIdle()

        assertFalse(viewModel.rewinding)
        assertEquals("q3", viewModel.input)
        assertEquals(listOf("q1", "a1", "q2", "a2"), viewModel.shownIds)
    }

    @Test
    fun labelsAreTrimmedStoredAndClearedWhenBlank() = runTest {
        client.onListMessages = { forkedTree() }
        val viewModel = viewModel()
        open(viewModel, trip)

        viewModel.labelMessage("q2", "  Plan ")
        advanceUntilIdle()

        assertEquals(Call("setMessageLabel", "trip", "q2", "Plan"), client.calls.last())
        assertEquals("Plan", viewModel.sessionTree?.rows?.single { it.id == "q2" }?.label)

        viewModel.labelMessage("q2", "  ")
        advanceUntilIdle()

        assertEquals(Call("setMessageLabel", "trip", "q2", null), client.calls.last())
        assertNull(viewModel.sessionTree?.rows?.single { it.id == "q2" }?.label)

        client.onSetMessageLabel = { _, _, _ -> throw ServiceException(ServiceFailure.Network) }
        viewModel.labelMessage("q2", "Plan")
        advanceUntilIdle()

        assertEquals(errorText(ServiceFailure.Network), viewModel.error)
    }

    @Test
    fun theTreeFollowsAStreamingTurnAndNavigationWaitsForItToEnd() = runTest {
        client.onListMessages = { forkedTree() }
        val events = Channel<AgentStreamEvent>(Channel.UNLIMITED)
        client.onSendMessage = { _, _, _, _, _ -> events.consumeAsFlow() }
        val viewModel = viewModel()
        open(viewModel, trip)

        send(viewModel, "Again")
        events.send(AgentStreamEvent.Started("q4"))
        events.send(AgentStreamEvent.TurnStarted("a4"))
        events.send(AgentStreamEvent.TextDelta("Sure"))
        advanceUntilIdle()

        val rows = assertNotNull(viewModel.sessionTree).rows
        assertEquals(listOf("q1", "a1", "q3", "a3", "q4", "a4", "q2", "a2"), rows.map { it.id })
        assertTrue(rows.single { it.id == "a4" }.let { it.onPath && it.isLeaf })

        viewModel.changeInput("draft")
        viewModel.switchLeaf("a2")
        viewModel.rewind("q2")
        advanceUntilIdle()

        assertFalse(client.calls.any { it.name == "setSessionLeaf" })
        assertFalse(viewModel.rewinding)
        assertEquals("draft", viewModel.input)

        client.onListMessages = {
            val stored = forkedTree()
            stored.copy(
                messages =
                    stored.messages +
                        ClientMessage("q4", "user", "Again", parentId = "a3") +
                        ClientMessage(
                            "a4",
                            "assistant",
                            "",
                            toolCalls = listOf(ClientToolCall("c1", "bash", "{}")),
                            parentId = "q4",
                        ) +
                        ClientMessage(
                            "t4",
                            "tool",
                            "ok",
                            toolResult = ClientToolResult("c1", isError = false),
                            parentId = "a4",
                        ) +
                        ClientMessage("a5", "assistant", "Sure", parentId = "t4"),
                leafId = "a5",
            )
        }
        events.send(AgentStreamEvent.Done())
        events.close()
        advanceUntilIdle()

        assertEquals(
            listOf("q1", "a1", "q3", "a3", "q4", "a5", "q2", "a2"),
            viewModel.sessionTree?.rows?.map { it.id },
        )
        viewModel.rewind("q4")

        assertEquals(listOf("q1", "a1", "q3", "a3"), viewModel.shownIds)
        assertEquals("Again", viewModel.input)
    }

    @Test
    fun leavingASessionDuringARewindRestoresTheDraftInsteadOfTheQuestion() = runTest {
        client.onListMessages = { forkedTree() }
        val viewModel = viewModel()
        open(viewModel, trip)
        viewModel.changeInput("draft")

        viewModel.rewind("q3")
        open(viewModel, work)

        assertFalse(viewModel.rewinding)
        assertEquals("draft", viewModel.input)

        viewModel.rewind("q2")
        viewModel.newSession()

        assertEquals("draft", viewModel.input)
    }

    @Test
    fun treeActionsWithoutAnOpenSessionDoNothing() = runTest {
        val viewModel = viewModel()
        viewModel.changeInput("draft")

        viewModel.switchLeaf("a1")
        viewModel.rewind("q1")
        viewModel.cancelRewind()
        viewModel.labelMessage("q1", "Plan")
        advanceUntilIdle()

        assertNull(viewModel.sessionTree)
        assertFalse(viewModel.rewinding)
        assertEquals("draft", viewModel.input)
        assertEquals(listOf(Call("listSessions"), Call("listProviders")), client.calls)
    }
}
