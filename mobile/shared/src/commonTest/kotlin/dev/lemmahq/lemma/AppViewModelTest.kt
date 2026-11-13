package dev.lemmahq.lemma

import dev.lemmahq.lemma.client.FakeConnector
import dev.lemmahq.lemma.client.FakeLemmaClient
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.i18n.UiText
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.errors_engine_failed

@OptIn(ExperimentalCoroutinesApi::class)
class AppViewModelTest {

    private val client = FakeLemmaClient()
    private val connector = FakeConnector(client)
    private val dispatcher = StandardTestDispatcher()

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun opensTheEngineOnStartAndIgnoresRetryUnlessFailed() = runTest {
        val opening = CompletableDeferred<Unit>()
        connector.onOpen = {
            opening.await()
            client
        }
        val viewModel = AppViewModel(connector)
        runCurrent()

        assertEquals(AppState.Opening, viewModel.state)
        viewModel.retry()
        assertEquals(1, connector.openCalls)

        opening.complete(Unit)
        advanceUntilIdle()
        assertEquals(AppState.Ready(client), viewModel.state)
        viewModel.retry()
        assertEquals(1, connector.openCalls)
    }

    @Test
    fun aFailedEngineStartCanBeRetried() = runTest {
        var fail = true
        connector.onOpen = {
            if (fail) throw ServiceException(ServiceFailure.Unspecified)
            client
        }
        val viewModel = AppViewModel(connector)
        advanceUntilIdle()

        assertEquals(
            AppState.Failed(UiText.Resource(Res.string.errors_engine_failed)),
            viewModel.state,
        )
        fail = false
        viewModel.retry()
        assertEquals(AppState.Opening, viewModel.state)
        advanceUntilIdle()

        assertEquals(AppState.Ready(client), viewModel.state)
        assertEquals(2, connector.openCalls)
    }
}
