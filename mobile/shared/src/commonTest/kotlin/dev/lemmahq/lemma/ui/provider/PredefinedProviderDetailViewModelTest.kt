package dev.lemmahq.lemma.ui.provider

import dev.lemmahq.lemma.client.ClientPredefinedProviderPatch
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.FakeLemmaClient
import dev.lemmahq.lemma.client.FakeLemmaClient.Call
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.client.samplePredefinedProvider
import dev.lemmahq.lemma.i18n.UiText
import dev.lemmahq.lemma.i18n.errorText
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
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain

@OptIn(ExperimentalCoroutinesApi::class)
class PredefinedProviderDetailViewModelTest {

    private val stored = samplePredefinedProvider("deepseek", "deepseek-flash", "deepseek-v4-pro")
    private val client = FakeLemmaClient()
    private val changes = mutableListOf<ClientProvider>()

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel(provider: ClientProvider = stored) =
        PredefinedProviderDetailViewModel(client, provider) { changes += it }

    @Test
    fun enablingWaitsForASavedKeyRatherThanADraft() = runTest {
        val viewModel = viewModel()

        viewModel.apiKey = "sk-draft"
        viewModel.setEnabled(true)
        advanceUntilIdle()

        assertFalse(viewModel.canEnable)
        assertFalse(viewModel.provider.enabled)
        assertEquals(emptyList(), client.calls)

        client.onUpdatePredefinedProvider = { _, patch ->
            stored.copy(apiKey = patch.apiKey ?: stored.apiKey)
        }
        viewModel.save()
        advanceUntilIdle()

        assertTrue(viewModel.canEnable)
        assertEquals("sk-draft", viewModel.provider.apiKey)
        assertFalse(viewModel.dirty)
        assertEquals(
            listOf(
                Call(
                    "updatePredefinedProvider",
                    "deepseek",
                    ClientPredefinedProviderPatch(apiKey = "sk-draft"),
                )
            ),
            client.calls,
        )
    }

    @Test
    fun discardingRestoresTheSavedKey() = runTest {
        val viewModel = viewModel(stored.copy(apiKey = "sk-saved"))

        viewModel.apiKey = " sk-other "
        assertTrue(viewModel.dirty)
        viewModel.discardEdits()

        assertEquals("sk-saved", viewModel.apiKey)
        assertFalse(viewModel.dirty)
    }

    @Test
    fun defaultFormatUsesTheServedOptionsAndPersistsImmediately() = runTest {
        val viewModel = viewModel(stored.copy(apiKey = "sk-saved"))

        assertEquals(listOf("anthropic", "openai"), viewModel.predefined.apiFormats)
        viewModel.setDefaultApiFormat("openai")
        advanceUntilIdle()

        assertEquals("openai", viewModel.predefined.defaultApiFormat)
        assertEquals(
            listOf(
                Call(
                    "updatePredefinedProvider",
                    "deepseek",
                    ClientPredefinedProviderPatch(defaultApiFormat = "openai"),
                )
            ),
            client.calls,
        )
    }

    @Test
    fun rejectedImmediateChangesRevert() = runTest {
        client.onUpdatePredefinedProvider = { _, _ ->
            throw ServiceException(ServiceFailure.Network)
        }
        val viewModel = viewModel(stored.copy(apiKey = "sk-saved", enabled = true))

        viewModel.setDefaultApiFormat("openai")
        advanceUntilIdle()
        assertEquals("anthropic", viewModel.predefined.defaultApiFormat)
        assertEquals(errorText(ServiceFailure.Network), viewModel.error)

        viewModel.setEnabled(false)
        advanceUntilIdle()
        assertTrue(viewModel.provider.enabled)
    }

    @Test
    fun theConnectivityCheckUsesTheStoredProviderAndPickedModel() = runTest {
        client.onCheckProvider = { _, _ -> "upstream 401" }
        val viewModel = viewModel(stored.copy(apiKey = "sk-saved", enabled = true))

        viewModel.pickedCheckModel = "deepseek-v4-pro"
        viewModel.check()
        advanceUntilIdle()

        assertEquals(
            listOf(Call("checkProvider", "deepseek", "deepseek-v4-pro")),
            client.calls,
        )
        assertEquals(CheckResult.Failed(UiText.Raw("upstream 401")), viewModel.checkResult)
    }

    @Test
    fun failedSaveAndCheckShowTheirReasons() = runTest {
        client.onUpdatePredefinedProvider = { _, _ ->
            throw ServiceException(ServiceFailure.Timeout)
        }
        client.onCheckProvider = { _, _ -> throw ServiceException(ServiceFailure.Network) }
        val viewModel = viewModel()

        viewModel.apiKey = "sk-draft"
        viewModel.save()
        advanceUntilIdle()
        assertEquals(errorText(ServiceFailure.Timeout), viewModel.error)
        assertTrue(viewModel.dirty)

        viewModel.check()
        advanceUntilIdle()
        assertEquals(CheckResult.Failed(errorText(ServiceFailure.Network)), viewModel.checkResult)
    }

    @Test
    fun aProviderWithoutModelsCannotCheck() = runTest {
        val viewModel = viewModel(samplePredefinedProvider("deepseek"))

        viewModel.pickedCheckModel = "unknown"
        viewModel.check()
        advanceUntilIdle()

        assertNull(viewModel.checkModel)
        assertNull(viewModel.checkResult)
        assertEquals(emptyList(), client.calls)
    }

    @Test
    fun savingNeedsAnEditAndRunsOneAtATime() = runTest {
        val reply = CompletableDeferred<ClientProvider>()
        client.onUpdatePredefinedProvider = { _, _ -> reply.await() }
        val viewModel = viewModel()

        viewModel.save()
        viewModel.apiKey = "sk-draft"
        viewModel.save()
        viewModel.save()
        advanceUntilIdle()
        reply.complete(stored.copy(apiKey = "sk-draft"))
        advanceUntilIdle()

        assertEquals(listOf("updatePredefinedProvider"), client.calls.map { it.name })
        assertFalse(viewModel.saving)
        assertFalse(viewModel.dirty)
    }

    @Test
    fun aCheckResultBelongsToTheKeyAndModelItRanWith() = runTest {
        val replies = mutableMapOf<String, CompletableDeferred<String>>()
        client.onCheckProvider = { _, model -> replies.getValue(model).await() }
        client.onUpdatePredefinedProvider = { _, patch ->
            stored.copy(apiKey = patch.apiKey.orEmpty())
        }
        replies["deepseek-flash"] = CompletableDeferred()
        replies["deepseek-v4-pro"] = CompletableDeferred()
        val viewModel = viewModel(stored.copy(apiKey = "sk-saved"))

        viewModel.check()
        advanceUntilIdle()
        viewModel.pickedCheckModel = "deepseek-v4-pro"
        viewModel.check()
        advanceUntilIdle()
        replies.getValue("deepseek-flash").complete("upstream 500")
        replies.getValue("deepseek-v4-pro").complete("")
        advanceUntilIdle()
        assertEquals(CheckResult.Passed, viewModel.checkResult)

        viewModel.apiKey = "sk-rotated"
        viewModel.save()
        advanceUntilIdle()
        assertNull(viewModel.checkResult)
    }
}
