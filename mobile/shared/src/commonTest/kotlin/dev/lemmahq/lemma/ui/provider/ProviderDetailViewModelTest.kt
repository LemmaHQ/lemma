package dev.lemmahq.lemma.ui.provider

import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.ClientProviderInput
import dev.lemmahq.lemma.client.ClientProviderPatch
import dev.lemmahq.lemma.client.FakeLemmaClient
import dev.lemmahq.lemma.client.FakeLemmaClient.Call
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.client.sampleProvider
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
class ProviderDetailViewModelTest {

    private val stored = sampleProvider("openai", "gpt-4o", "gpt-4o-mini")
    private val client = FakeLemmaClient()
    private val changes = mutableListOf<ClientProvider>()
    private val deletions = mutableListOf<String>()

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel() =
        ProviderDetailViewModel(client, stored, { changes += it }, { deletions += it })

    @Test
    fun savingSendsOnlyTheChangedConnectionFieldsAndShowsTheStoredValues() = runTest {
        client.onUpdateProvider = { _, _ -> stored.copy(baseUrl = "https://proxy.example.com/v1") }
        val viewModel = viewModel()

        viewModel.baseUrl = " https://proxy.example.com/v1/ "
        assertTrue(viewModel.dirty)
        viewModel.save()
        advanceUntilIdle()

        val patch = ClientProviderPatch(baseUrl = "https://proxy.example.com/v1/")
        assertEquals(listOf(Call("updateProvider", "openai", patch)), client.calls)
        assertEquals("https://proxy.example.com/v1", viewModel.baseUrl)
        assertFalse(viewModel.dirty)
        assertEquals(listOf(viewModel.provider), changes)
    }

    @Test
    fun aBaseUrlWithoutAnHttpSchemeCannotBeSaved() = runTest {
        val viewModel = viewModel()

        viewModel.baseUrl = "api.example.com"
        viewModel.save()
        advanceUntilIdle()

        assertTrue(viewModel.dirty)
        assertFalse(viewModel.baseUrlValid)
        assertEquals(emptyList(), client.calls)
    }

    @Test
    fun discardingPutsTheStoredValuesBack() = runTest {
        val viewModel = viewModel()
        viewModel.apiKey = "sk-2"
        viewModel.apiPath = "/v2/chat"

        viewModel.discardEdits()

        assertEquals("sk-1", viewModel.apiKey)
        assertEquals("", viewModel.apiPath)
        assertFalse(viewModel.dirty)
    }

    @Test
    fun aRejectedToggleRevertsTheEnabledFlag() = runTest {
        val gate = CompletableDeferred<Unit>()
        client.onUpdateProvider = { _, _ ->
            gate.await()
            throw ServiceException(ServiceFailure.Network)
        }
        val viewModel = viewModel()

        viewModel.setEnabled(false)
        advanceUntilIdle()
        assertFalse(viewModel.provider.enabled)
        gate.complete(Unit)
        advanceUntilIdle()

        assertTrue(viewModel.provider.enabled)
        assertEquals(errorText(ServiceFailure.Network), viewModel.error)
        assertEquals(listOf(false, true), changes.map { it.enabled })
    }

    @Test
    fun modelsAreAddedFirstOnceAndRemovedAtOnce() = runTest {
        val viewModel = viewModel()

        viewModel.addModel(" o3 ")
        viewModel.addModel("gpt-4o")
        viewModel.addModel(" ")
        viewModel.removeModel("gpt-4o-mini")
        advanceUntilIdle()

        assertEquals(listOf("o3", "gpt-4o"), viewModel.provider.models)
        assertEquals(
            listOf(
                Call(
                    "updateProvider",
                    "openai",
                    ClientProviderPatch(models = listOf("o3", "gpt-4o", "gpt-4o-mini")),
                ),
                Call(
                    "updateProvider",
                    "openai",
                    ClientProviderPatch(models = listOf("o3", "gpt-4o")),
                ),
            ),
            client.calls,
        )
    }

    @Test
    fun fetchingUsesTheStoredProviderUntilTheConnectionIsEdited() = runTest {
        client.onFetchProviderModels = { listOf("gpt-4o", "o3") }
        client.onFetchModels = { _, _, _, _ -> listOf("claude") }
        val viewModel = viewModel()

        viewModel.fetchModels()
        advanceUntilIdle()
        assertEquals(listOf("gpt-4o", "o3"), viewModel.fetched)

        viewModel.apiKey = " sk-2 "
        viewModel.fetchModels()
        advanceUntilIdle()

        assertEquals(listOf("claude"), viewModel.fetched)
        assertEquals(
            listOf(
                Call("fetchProviderModels", "openai"),
                Call("fetchModels", "openai", "https://api.example.com/v1", "sk-2", ""),
            ),
            client.calls,
        )
    }

    @Test
    fun pickedFetchedModelsAreAppendedWithoutDuplicates() = runTest {
        val viewModel = viewModel()

        viewModel.addFetched(listOf("gpt-4o", "o3"))
        advanceUntilIdle()

        assertNull(viewModel.fetched)
        assertEquals(listOf("gpt-4o", "gpt-4o-mini", "o3"), viewModel.provider.models)
    }

    @Test
    fun theCheckUsesTheStoredProviderUntilTheConnectionIsEdited() = runTest {
        client.onCheckProvider = { id, _, _ -> if (id == null) "upstream 401" else "" }
        val viewModel = viewModel()

        viewModel.check()
        advanceUntilIdle()
        assertEquals(CheckResult.Passed, viewModel.checkResult)

        viewModel.apiKey = "sk-wrong"
        assertNull(viewModel.checkResult)
        viewModel.pickedCheckModel = "gpt-4o-mini"
        viewModel.check()
        advanceUntilIdle()

        assertEquals(CheckResult.Failed(UiText.Raw("upstream 401")), viewModel.checkResult)
        val edited =
            ClientProviderInput(
                kind = "openai",
                identifier = "openai",
                name = "openai",
                baseUrl = "https://api.example.com/v1",
                apiKey = "sk-wrong",
            )
        assertEquals(
            Call("checkProvider", null, edited, "gpt-4o-mini"),
            client.calls.last(),
        )
    }

    @Test
    fun aBlankNameSavesTheProviderId() = runTest {
        client.onUpdateProvider = { _, patch -> stored.copy(name = patch.name ?: stored.name) }
        val viewModel = viewModel()

        viewModel.openSettings()
        assertFalse(viewModel.nameChanged)
        viewModel.nameDraft = "Work"
        viewModel.saveName()
        advanceUntilIdle()
        viewModel.openSettings()
        viewModel.nameDraft = "  "
        assertTrue(viewModel.nameChanged)
        viewModel.saveName()
        advanceUntilIdle()

        assertNull(viewModel.nameDraft)
        assertEquals(listOf("Work", "openai"), changes.map { it.name })
    }

    @Test
    fun deletingReportsTheProviderOnlyOnceTheServiceDeletesIt() = runTest {
        client.onDeleteProvider = { throw ServiceException(ServiceFailure.ProviderNotFound) }
        val viewModel = viewModel()

        viewModel.delete()
        advanceUntilIdle()
        assertEquals(emptyList(), deletions)
        assertEquals(errorText(ServiceFailure.ProviderNotFound), viewModel.error)

        client.onDeleteProvider = {}
        viewModel.delete()
        advanceUntilIdle()

        assertEquals(listOf("openai"), deletions)
    }

    @Test
    fun savingWaitsForAnEditAndSendsOnceAtATime() = runTest {
        val viewModel = viewModel()

        viewModel.save()
        viewModel.apiPath = " /v2/chat "
        viewModel.save()
        viewModel.save()
        advanceUntilIdle()

        val patch = ClientProviderPatch(apiPath = "/v2/chat")
        assertEquals(listOf(Call("updateProvider", "openai", patch)), client.calls)
    }

    @Test
    fun failedRequestsShowTheirReason() = runTest {
        client.onUpdateProvider = { _, _ -> throw ServiceException(ServiceFailure.Network) }
        client.onFetchProviderModels = { throw ServiceException(ServiceFailure.Timeout) }
        client.onCheckProvider = { _, _, _ -> throw ServiceException(ServiceFailure.Network) }
        val viewModel = viewModel()

        viewModel.baseUrl = "https://proxy.example.com/v1"
        viewModel.save()
        advanceUntilIdle()
        assertEquals(errorText(ServiceFailure.Network), viewModel.error)
        assertTrue(viewModel.dirty)

        viewModel.discardEdits()
        viewModel.fetchModels()
        advanceUntilIdle()
        assertEquals(errorText(ServiceFailure.Timeout), viewModel.error)
        assertNull(viewModel.fetched)

        viewModel.check()
        advanceUntilIdle()
        assertEquals(CheckResult.Failed(errorText(ServiceFailure.Network)), viewModel.checkResult)

        viewModel.openSettings()
        viewModel.nameDraft = "Work"
        viewModel.saveName()
        advanceUntilIdle()
        assertEquals(errorText(ServiceFailure.Network), viewModel.nameError)
        assertEquals("Work", viewModel.nameDraft)
    }

    @Test
    fun closedDialogsKeepNothing() = runTest {
        client.onFetchProviderModels = { listOf("o3") }
        val viewModel = viewModel()

        viewModel.openSettings()
        viewModel.nameDraft = "Work"
        viewModel.closeSettings()
        viewModel.saveName()
        viewModel.fetchModels()
        advanceUntilIdle()
        viewModel.dismissFetched()

        assertFalse(viewModel.nameChanged)
        assertNull(viewModel.fetched)
        assertEquals(listOf(Call("fetchProviderModels", "openai")), client.calls)
    }

    @Test
    fun theCheckModelFallsBackToTheFirstListedModel() = runTest {
        val viewModel = viewModel()

        viewModel.pickedCheckModel = "o3"
        assertEquals("gpt-4o", viewModel.checkModel)

        viewModel.removeModel("gpt-4o")
        viewModel.removeModel("gpt-4o-mini")
        viewModel.check()
        advanceUntilIdle()

        assertNull(viewModel.checkModel)
        assertNull(viewModel.checkResult)
        assertFalse(client.calls.any { it.name == "checkProvider" })
    }

    @Test
    fun onlyTheLatestCheckReports() = runTest {
        val first = CompletableDeferred<String>()
        val second = CompletableDeferred<String>()
        val replies = ArrayDeque(listOf(first, second))
        client.onCheckProvider = { _, _, _ -> replies.removeFirst().await() }
        val viewModel = viewModel()

        viewModel.check()
        advanceUntilIdle()
        viewModel.apiKey = "sk-2"
        viewModel.check()
        advanceUntilIdle()
        first.complete("")
        advanceUntilIdle()
        assertEquals(CheckResult.Checking, viewModel.checkResult)

        second.complete("upstream 401")
        advanceUntilIdle()
        assertEquals(CheckResult.Failed(UiText.Raw("upstream 401")), viewModel.checkResult)
    }
}
