package dev.lemmahq.lemma.ui.provider

import dev.lemmahq.lemma.client.FakeLemmaClient
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.client.sampleProvider
import dev.lemmahq.lemma.i18n.errorText
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain

@OptIn(ExperimentalCoroutinesApi::class)
class ProviderViewModelTest {

    private val openai = sampleProvider("openai").copy(name = "OpenAI")
    private val claude = sampleProvider("claude", enabled = false).copy(name = "Claude")
    private val client = FakeLemmaClient().apply { onListProviders = { listOf(openai, claude) } }

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun theQueryMatchesNamesIgnoringCase() = runTest {
        val viewModel = ProviderViewModel(client)
        assertTrue(viewModel.loading)
        advanceUntilIdle()

        viewModel.query = " ope "

        assertFalse(viewModel.loading)
        assertEquals(listOf(openai), viewModel.matches)
    }

    @Test
    fun storedProvidersReplaceTheirOldVersionOrAreAppended() = runTest {
        val viewModel = ProviderViewModel(client)
        advanceUntilIdle()
        val gemini = sampleProvider("gemini")

        viewModel.store(openai.copy(enabled = false))
        viewModel.store(gemini)
        viewModel.remove("claude")

        assertEquals(listOf(openai.copy(enabled = false), gemini), viewModel.providers)
        assertEquals(gemini, viewModel.provider("gemini"))
    }

    @Test
    fun aFailedLoadShowsItsReason() = runTest {
        client.onListProviders = { throw ServiceException(ServiceFailure.Network) }

        val viewModel = ProviderViewModel(client)
        advanceUntilIdle()

        assertFalse(viewModel.loading)
        assertEquals(errorText(ServiceFailure.Network), viewModel.error)
    }
}
