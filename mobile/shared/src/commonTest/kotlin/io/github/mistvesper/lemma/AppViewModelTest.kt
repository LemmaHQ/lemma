package io.github.mistvesper.lemma

import io.github.mistvesper.lemma.client.FakeEngineOpener
import io.github.mistvesper.lemma.client.FakeLemmaClient
import io.github.mistvesper.lemma.client.ServiceException
import io.github.mistvesper.lemma.client.ServiceFailure
import io.github.mistvesper.lemma.i18n.UiText
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
    private val engineOpener = FakeEngineOpener(client)
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
        engineOpener.onOpen = {
            opening.await()
            client
        }
        val viewModel = AppViewModel(engineOpener)
        runCurrent()

        assertEquals(AppState.Opening, viewModel.state)
        viewModel.retry()
        assertEquals(1, engineOpener.openCalls)

        opening.complete(Unit)
        advanceUntilIdle()
        assertEquals(AppState.Ready(client), viewModel.state)
        viewModel.retry()
        assertEquals(1, engineOpener.openCalls)
    }

    @Test
    fun aFailedEngineStartCanBeRetried() = runTest {
        var fail = true
        engineOpener.onOpen = {
            if (fail) throw ServiceException(ServiceFailure.Unspecified)
            client
        }
        val viewModel = AppViewModel(engineOpener)
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
        assertEquals(2, engineOpener.openCalls)
    }
}
