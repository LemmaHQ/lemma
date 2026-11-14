package dev.lemmahq.lemma.ui.provider

import dev.lemmahq.lemma.client.ClientCustomProvider
import dev.lemmahq.lemma.client.ClientCustomProviderPatch
import dev.lemmahq.lemma.client.ClientModel
import dev.lemmahq.lemma.client.ClientProvider
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
    fun savingSendsOnlyTheChangedConnectionFieldsAndClearsKeys() = runTest {
        client.onUpdateCustomProvider = { _, patch ->
            stored.copy(apiKey = patch.apiKey ?: stored.apiKey).withCustom {
                copy(baseUrl = patch.baseUrl ?: baseUrl)
            }
        }
        val viewModel = viewModel()
        assertEquals("sk-test", viewModel.apiKey)
        assertFalse(viewModel.dirty)

        viewModel.apiKey = " sk-test "
        assertFalse(viewModel.dirty)

        viewModel.baseUrl = " https://proxy.example.com/v1/ "
        assertTrue(viewModel.dirty)
        viewModel.save()
        advanceUntilIdle()

        val patch = ClientCustomProviderPatch(baseUrl = "https://proxy.example.com/v1/")
        assertEquals(listOf(Call("updateCustomProvider", "openai", patch)), client.calls)
        assertEquals("https://proxy.example.com/v1/", viewModel.baseUrl)
        assertFalse(viewModel.dirty)
        assertEquals(listOf(viewModel.provider), changes)

        viewModel.apiKey = " sk-rotated "
        assertTrue(viewModel.dirty)
        viewModel.save()
        advanceUntilIdle()

        val keyPatch = ClientCustomProviderPatch(apiKey = "sk-rotated")
        assertEquals(Call("updateCustomProvider", "openai", keyPatch), client.calls.last())
        assertEquals("sk-rotated", viewModel.apiKey)
        assertFalse(viewModel.dirty)

        viewModel.apiKey = "  "
        assertTrue(viewModel.dirty)
        viewModel.save()
        advanceUntilIdle()

        val clearPatch = ClientCustomProviderPatch(apiKey = "")
        assertEquals(Call("updateCustomProvider", "openai", clearPatch), client.calls.last())
        assertEquals("", viewModel.apiKey)
        assertFalse(viewModel.dirty)
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
    fun discardingRestoresStoredKeyAndConnectionFields() = runTest {
        val viewModel = viewModel()
        viewModel.apiKey = "sk-2"
        viewModel.apiPath = "/v2/chat"

        viewModel.discardEdits()

        assertEquals("sk-test", viewModel.apiKey)
        assertEquals("", viewModel.apiPath)
        assertFalse(viewModel.dirty)
    }

    @Test
    fun aRejectedToggleRevertsTheEnabledFlag() = runTest {
        val gate = CompletableDeferred<Unit>()
        client.onUpdateCustomProvider = { _, _ ->
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
    fun modelsAreAddedFirstOnceWithToolCallingAndRemovedAtOnce() = runTest {
        val viewModel = viewModel()

        viewModel.addModel(" o3 ")
        viewModel.addModel("gpt-4o")
        viewModel.addModel(" ")
        viewModel.removeModel("gpt-4o-mini")
        advanceUntilIdle()

        assertEquals(listOf("o3", "gpt-4o"), viewModel.custom.models.map { it.id })
        assertEquals(
            listOf(
                Call(
                    "updateCustomProvider",
                    "openai",
                    ClientCustomProviderPatch(models = modelIds("o3", "gpt-4o", "gpt-4o-mini")),
                ),
                Call(
                    "updateCustomProvider",
                    "openai",
                    ClientCustomProviderPatch(models = modelIds("o3", "gpt-4o")),
                ),
            ),
            client.calls,
        )
        assertTrue(viewModel.custom.models.all { it.toolCalling })
    }

    @Test
    fun toolCallingChangesPersistThroughTheModelPatch() = runTest {
        val viewModel = viewModel()

        viewModel.setToolCalling("gpt-4o", false)
        advanceUntilIdle()

        val expected = listOf(ClientModel("gpt-4o", false), ClientModel("gpt-4o-mini", true))
        assertEquals(expected, viewModel.custom.models)
        assertEquals(
            listOf(
                Call(
                    "updateCustomProvider",
                    "openai",
                    ClientCustomProviderPatch(models = expected),
                )
            ),
            client.calls,
        )
    }

    @Test
    fun aRejectedToolCallingChangeRestoresTheModels() = runTest {
        client.onUpdateCustomProvider = { _, _ -> throw ServiceException(ServiceFailure.Network) }
        val viewModel = viewModel()

        viewModel.setToolCalling("gpt-4o", false)
        advanceUntilIdle()

        assertTrue(viewModel.custom.models.all { it.toolCalling })
        assertEquals(errorText(ServiceFailure.Network), viewModel.error)
    }

    @Test
    fun fetchingUsesTheStoredProviderAndIsGatedWhileDirtyOrFetching() = runTest {
        val reply = CompletableDeferred<List<String>>()
        client.onFetchModels = { reply.await() }
        val viewModel = viewModel()

        viewModel.apiKey = " sk-2 "
        viewModel.fetchModels()
        advanceUntilIdle()
        assertEquals(emptyList(), client.calls)
        assertNull(viewModel.fetched)

        viewModel.discardEdits()
        viewModel.fetchModels()
        viewModel.fetchModels()
        advanceUntilIdle()
        reply.complete(listOf("gpt-4o", "o3"))
        advanceUntilIdle()

        assertEquals(listOf("gpt-4o", "o3"), viewModel.fetched)
        assertEquals(listOf(Call("fetchModels", "openai")), client.calls)
    }

    @Test
    fun pickedFetchedModelsAreAppendedWithoutDuplicates() = runTest {
        val viewModel = viewModel()

        viewModel.addFetched(listOf("gpt-4o", "o3"))
        advanceUntilIdle()

        assertNull(viewModel.fetched)
        assertEquals(listOf("gpt-4o", "gpt-4o-mini", "o3"), viewModel.custom.models.map { it.id })
        assertTrue(viewModel.custom.models.last().toolCalling)
    }

    @Test
    fun theCheckUsesTheStoredProviderAndIsGatedWhileDirty() = runTest {
        client.onCheckProvider = { _, model -> if (model == "gpt-4o") "" else "upstream 401" }
        val viewModel = viewModel()

        viewModel.check()
        advanceUntilIdle()
        assertEquals(CheckResult.Passed, viewModel.checkResult)

        viewModel.apiKey = "sk-wrong"
        assertNull(viewModel.checkResult)
        viewModel.pickedCheckModel = "gpt-4o-mini"
        viewModel.check()
        advanceUntilIdle()
        assertEquals(listOf(Call("checkProvider", "openai", "gpt-4o")), client.calls)

        viewModel.discardEdits()
        viewModel.check()
        advanceUntilIdle()
        assertEquals(CheckResult.Failed(UiText.Raw("upstream 401")), viewModel.checkResult)
        assertEquals(Call("checkProvider", "openai", "gpt-4o-mini"), client.calls.last())

        viewModel.apiKey = "sk-rotated"
        viewModel.save()
        advanceUntilIdle()
        assertNull(viewModel.checkResult)
    }

    @Test
    fun aBlankNameSavesTheProviderId() = runTest {
        client.onUpdateCustomProvider = { _, patch ->
            stored.withCustom { copy(name = patch.name ?: name) }
        }
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
        assertEquals(listOf("Work", "openai"), changes.map { it.custom.name })
    }

    @Test
    fun deletingReportsTheProviderOnlyOnceTheServiceDeletesIt() = runTest {
        client.onDeleteCustomProvider = { throw ServiceException(ServiceFailure.ProviderNotFound) }
        val viewModel = viewModel()

        viewModel.delete()
        advanceUntilIdle()
        assertEquals(emptyList(), deletions)
        assertEquals(errorText(ServiceFailure.ProviderNotFound), viewModel.error)

        client.onDeleteCustomProvider = {}
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

        val patch = ClientCustomProviderPatch(apiPath = "/v2/chat")
        assertEquals(listOf(Call("updateCustomProvider", "openai", patch)), client.calls)
    }

    @Test
    fun failedRequestsShowTheirReason() = runTest {
        client.onUpdateCustomProvider = { _, _ -> throw ServiceException(ServiceFailure.Network) }
        client.onFetchModels = { throw ServiceException(ServiceFailure.Timeout) }
        client.onCheckProvider = { _, _ -> throw ServiceException(ServiceFailure.Network) }
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
        client.onFetchModels = { listOf("o3") }
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
        assertEquals(listOf(Call("fetchModels", "openai")), client.calls)
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
        assertFalse(client.calls.any { it.name.startsWith("check") })
    }

    @Test
    fun onlyTheLatestCheckReports() = runTest {
        val first = CompletableDeferred<String>()
        val second = CompletableDeferred<String>()
        client.onCheckProvider = { _, model ->
            if (model == "gpt-4o") first.await() else second.await()
        }
        val viewModel = viewModel()

        viewModel.check()
        advanceUntilIdle()
        viewModel.pickedCheckModel = "gpt-4o-mini"
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

private val ClientProvider.custom: ClientCustomProvider
    get() = source as ClientCustomProvider

private fun ClientProvider.withCustom(change: ClientCustomProvider.() -> ClientCustomProvider) =
    copy(source = custom.change())

private fun modelIds(vararg ids: String) = ids.map { ClientModel(it, toolCalling = true) }
