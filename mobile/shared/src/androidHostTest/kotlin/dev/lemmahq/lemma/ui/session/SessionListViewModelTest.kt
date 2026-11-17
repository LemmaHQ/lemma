package dev.lemmahq.lemma.ui.session

import androidx.lifecycle.SavedStateHandle
import com.russhwolf.settings.MapSettings
import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.ClientMessageTree
import dev.lemmahq.lemma.client.ClientSession
import dev.lemmahq.lemma.client.FakeLemmaClient
import dev.lemmahq.lemma.client.FakeLemmaClient.Call
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.client.sampleMessage
import dev.lemmahq.lemma.client.sampleProvider
import dev.lemmahq.lemma.client.sampleSession
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.i18n.errorText
import dev.lemmahq.lemma.ui.agent.AgentViewModel
import dev.lemmahq.lemma.ui.session.SessionMarker.Failed
import dev.lemmahq.lemma.ui.session.SessionMarker.Finished
import dev.lemmahq.lemma.ui.session.SessionMarker.Running
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain

@OptIn(ExperimentalCoroutinesApi::class)
class SessionListViewModelTest {

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

    private fun agent() = AgentViewModel(client, settings, SavedStateHandle())

    private fun TestScope.viewModel(agent: AgentViewModel) =
        SessionListViewModel(client, agent).also {
            agent.loadProviders()
            advanceUntilIdle()
        }

    private fun TestScope.open(agent: AgentViewModel, session: ClientSession) {
        agent.selectSession(session)
        advanceUntilIdle()
    }

    @Test
    fun sessionsLoadWhenTheViewModelStartsAndRefresh() = runTest {
        client.onListSessions = { listOf(trip) }
        val viewModel = SessionListViewModel(client, agent())
        advanceUntilIdle()
        assertEquals(listOf(trip), viewModel.sessions)

        client.onListSessions = { listOf(work, trip) }
        viewModel.refreshSessions()
        advanceUntilIdle()

        assertEquals(listOf(work, trip), viewModel.sessions)
    }

    @Test
    fun renamingTrimsTheTitleAndSkipsBlankOrUnchangedOnes() = runTest {
        client.onListSessions = { listOf(trip, work) }
        val agent = agent()
        val viewModel = viewModel(agent)

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
        assertEquals(errorText(ServiceFailure.SessionNotFound), agent.error)
        assertEquals(listOf("Paris", "Work"), viewModel.sessions.map { it.title })
    }

    @Test
    fun deletingTheOpenSessionClosesIt() = runTest {
        client.onListSessions = { listOf(trip, work) }
        client.onListMessages = {
            ClientMessageTree(listOf(sampleMessage("q1", "user")), leafId = "q1")
        }
        val agent = agent()
        val viewModel = viewModel(agent)
        open(agent, trip)

        client.onDeleteSession = { throw ServiceException(ServiceFailure.Network) }
        viewModel.deleteSession(trip)
        advanceUntilIdle()
        assertEquals(errorText(ServiceFailure.Network), agent.error)
        assertEquals(trip, viewModel.currentSession)

        client.onDeleteSession = {}
        viewModel.deleteSession(trip)
        advanceUntilIdle()

        assertEquals(listOf(work), viewModel.sessions)
        assertNull(agent.openSession)
    }

    private fun TestScope.send(agent: AgentViewModel, viewModel: SessionListViewModel) {
        agent.changeInput("Hello")
        agent.send(viewModel::createSession)
        advanceUntilIdle()
    }

    @Test
    fun runningMarkersComeFromEachLoadAndTheTurnsInBetween() = runTest {
        client.onListSessions = { listOf(trip.copy(activeMessageId = "q1"), work) }
        client.onSendMessage = { _, _, _, _, _ -> flow { awaitCancellation() } }
        val agent = agent()
        val viewModel = viewModel(agent)
        assertEquals(Running, viewModel.markerOf(trip))
        assertNull(viewModel.markerOf(work))

        viewModel.selectSession(work)
        advanceUntilIdle()
        send(agent, viewModel)
        assertEquals(Running, viewModel.markerOf(work))

        viewModel.selectSession(trip)
        advanceUntilIdle()
        assertEquals(Running, viewModel.markerOf(work))

        client.onListSessions = { listOf(trip, work) }
        viewModel.refreshSessions()
        advanceUntilIdle()
        assertNull(viewModel.markerOf(trip))
        assertNull(viewModel.markerOf(work))
    }

    @Test
    fun aFinishedTurnIsMarkedUntilOpenedUnlessItsSessionIsViewed() = runTest {
        client.onListSessions = { listOf(trip, work) }
        val agent = agent()
        val viewModel = viewModel(agent)
        viewModel.selectSession(trip)
        advanceUntilIdle()

        send(agent, viewModel)
        assertNull(viewModel.markerOf(trip))

        client.onSendMessage = { _, _, _, _, _ ->
            flow {
                emit(AgentStreamEvent.Started("q2"))
                emit(AgentStreamEvent.Done())
                agent.selectSession(work)
            }
        }
        send(agent, viewModel)
        assertEquals(Finished, viewModel.markerOf(trip))

        viewModel.selectSession(trip)
        advanceUntilIdle()
        assertNull(viewModel.markerOf(trip))

        client.onSendMessage = { _, _, _, _, _ ->
            flow {
                emit(AgentStreamEvent.Started("q3"))
                emit(AgentStreamEvent.Done())
                agent.newSession()
            }
        }
        send(agent, viewModel)
        assertEquals(Finished, viewModel.markerOf(trip))
    }

    @Test
    fun aFailedTurnIsMarkedUntilOpenedOrALaterTurnSucceeds() = runTest {
        client.onListSessions = { listOf(trip, work) }
        val agent = agent()
        val viewModel = viewModel(agent)
        viewModel.selectSession(trip)
        advanceUntilIdle()

        client.onSendMessage = { _, _, _, _, _ ->
            flowOf(AgentStreamEvent.Started("q1"), AgentStreamEvent.Error("boom"))
        }
        send(agent, viewModel)
        assertEquals(Failed, viewModel.markerOf(trip))

        client.onSendMessage = { _, _, _, _, _ ->
            flowOf(
                AgentStreamEvent.Started("q2"),
                AgentStreamEvent.TextDelta("Hi"),
                AgentStreamEvent.Done(),
            )
        }
        send(agent, viewModel)
        assertNull(viewModel.markerOf(trip))

        client.onSendMessage = { _, _, _, _, _ ->
            flow { throw ServiceException(ServiceFailure.Network) }
        }
        send(agent, viewModel)
        assertEquals(Failed, viewModel.markerOf(trip))

        viewModel.selectSession(trip)
        assertNull(viewModel.markerOf(trip))
    }

    @Test
    fun anAbortedTurnOnlyEndsTheRunningMarker() = runTest {
        client.onListSessions = { listOf(trip, work) }
        client.onSendMessage = { _, _, _, _, _ ->
            flowOf(AgentStreamEvent.Started("q1"), AgentStreamEvent.Aborted())
        }
        val agent = agent()
        val viewModel = viewModel(agent)
        viewModel.selectSession(trip)
        advanceUntilIdle()

        send(agent, viewModel)

        assertNull(viewModel.markerOf(trip))
    }
}
