package dev.lemmahq.lemma.ui.provider

import dev.lemmahq.lemma.client.ClientWebFunction
import dev.lemmahq.lemma.client.ClientWebProvider
import dev.lemmahq.lemma.client.ClientWebProviderKind
import dev.lemmahq.lemma.client.ClientWebProviderPatch
import dev.lemmahq.lemma.client.FakeLemmaClient
import dev.lemmahq.lemma.client.FakeLemmaClient.Call
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
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
class WebProviderViewModelTest {

    private val client = FakeLemmaClient()
    private val stored = mutableListOf(native(), exa(), deepSeek())

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
        client.onListWebProviders = { stored.toList() }
        client.onUpdateWebProvider = { id, patch ->
            val index = stored.indexOfFirst { it.id == id }
            stored[index].patched(patch).also { stored[index] = it }
        }
        client.onSetWebProviderOrder = { _, _ -> stored.toList() }
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun viewModel() = WebProviderViewModel(client)

    @Test
    fun loadsAndSortsEachFunctionByItsOwnRank() = runTest {
        val viewModel = viewModel()
        advanceUntilIdle()

        assertFalse(viewModel.loading)
        assertNull(viewModel.error)
        assertEquals(stored, viewModel.providers)
        assertEquals(listOf("deepseek", "exa"), viewModel.searchProviders.map { it.id })
        assertEquals(listOf("deepseek", "exa", "native"), viewModel.fetchProviders.map { it.id })
        assertEquals(listOf(Call("listWebProviders")), client.calls)
    }

    @Test
    fun aFailedLoadShowsItsReason() = runTest {
        client.onListWebProviders = { throw ServiceException(ServiceFailure.Network) }
        val viewModel = viewModel()
        advanceUntilIdle()

        assertFalse(viewModel.loading)
        assertEquals(errorText(ServiceFailure.Network), viewModel.error)
        assertTrue(viewModel.providers.isEmpty())
    }

    @Test
    fun savingTrimsAndClearsTheKeyAndUpdatesTheStoredValue() = runTest {
        val viewModel = viewModel()
        advanceUntilIdle()
        assertEquals("sk-exa", viewModel.apiKey("exa"))
        assertFalse(viewModel.hasUnsavedKey("exa"))

        viewModel.setApiKey("exa", "  sk-exa  ")
        assertFalse(viewModel.hasUnsavedKey("exa"))

        viewModel.setApiKey("exa", "  sk-new  ")
        assertEquals("  sk-new  ", viewModel.apiKey("exa"))
        assertTrue(viewModel.hasUnsavedKey("exa"))
        viewModel.saveApiKey("exa")
        advanceUntilIdle()

        assertEquals("sk-new", viewModel.apiKey("exa"))
        assertFalse(viewModel.hasUnsavedKey("exa"))
        assertFalse(viewModel.isSaving("exa"))
        assertEquals(
            Call("updateWebProvider", "exa", ClientWebProviderPatch(apiKey = "sk-new")),
            client.calls.last(),
        )
        assertEquals("sk-new", viewModel.providers.single { it.id == "exa" }.apiKey)

        viewModel.setApiKey("exa", "")
        assertTrue(viewModel.hasUnsavedKey("exa"))
        viewModel.saveApiKey("exa")
        advanceUntilIdle()

        assertEquals("", viewModel.apiKey("exa"))
        assertEquals("", viewModel.providers.single { it.id == "exa" }.apiKey)
        assertEquals(
            Call("updateWebProvider", "exa", ClientWebProviderPatch(apiKey = "")),
            client.calls.last(),
        )
    }

    @Test
    fun unchangedKeysAndDuplicateSavesDoNotCallTheService() = runTest {
        val viewModel = viewModel()
        advanceUntilIdle()
        viewModel.saveApiKey("native")
        viewModel.saveApiKey("missing")
        viewModel.setApiKey("deepseek", "   ")
        viewModel.saveApiKey("deepseek")
        advanceUntilIdle()
        assertEquals(0, client.calls.count { it.name == "updateWebProvider" })
        assertFalse(viewModel.hasUnsavedKey("deepseek"))
        assertFalse(viewModel.hasUnsavedKey("missing"))

        val answer = CompletableDeferred<ClientWebProvider>()
        client.onUpdateWebProvider = { _, _ -> answer.await() }
        viewModel.setApiKey("exa", "sk-new")
        viewModel.saveApiKey("exa")
        advanceUntilIdle()
        assertTrue(viewModel.isSaving("exa"))
        viewModel.saveApiKey("exa")
        advanceUntilIdle()
        assertEquals(1, client.calls.count { it.name == "updateWebProvider" })

        answer.complete(exa().copy(apiKey = "sk-new"))
        advanceUntilIdle()
        assertFalse(viewModel.isSaving("exa"))
    }

    @Test
    fun aFailedKeySaveKeepsTheDraftAndCanBeDiscarded() = runTest {
        client.onUpdateWebProvider = { _, _ -> throw ServiceException(ServiceFailure.Network) }
        val viewModel = viewModel()
        advanceUntilIdle()
        viewModel.setApiKey("deepseek", "sk-new")
        viewModel.saveApiKey("deepseek")
        advanceUntilIdle()

        assertEquals("sk-new", viewModel.apiKey("deepseek"))
        assertEquals(errorText(ServiceFailure.Network), viewModel.error)
        assertFalse(viewModel.isSaving("deepseek"))
        viewModel.discardApiKey("deepseek")
        assertFalse(viewModel.hasUnsavedKey("deepseek"))
        assertEquals("", viewModel.apiKey("missing"))
    }

    @Test
    fun enablingRequiresASavedKeyExceptForNative() = runTest {
        val viewModel = viewModel()
        advanceUntilIdle()

        viewModel.setEnabled("deepseek", true)
        viewModel.setEnabled("missing", true)
        advanceUntilIdle()
        assertEquals(0, client.calls.count { it.name == "updateWebProvider" })
        assertFalse(viewModel.providers.single { it.id == "deepseek" }.enabled)

        viewModel.setEnabled("exa", true)
        viewModel.setEnabled("native", false)
        viewModel.setEnabled("native", true)
        advanceUntilIdle()
        assertTrue(viewModel.providers.single { it.id == "exa" }.enabled)
        assertTrue(viewModel.providers.single { it.id == "native" }.enabled)
        assertEquals(
            listOf(
                Call("updateWebProvider", "exa", ClientWebProviderPatch(enabled = true)),
                Call("updateWebProvider", "native", ClientWebProviderPatch(enabled = false)),
                Call("updateWebProvider", "native", ClientWebProviderPatch(enabled = true)),
            ),
            client.calls.filter { it.name == "updateWebProvider" },
        )
    }

    @Test
    fun aRejectedEnableRollsBackAndShowsItsReason() = runTest {
        client.onUpdateWebProvider = { _, _ -> throw ServiceException(ServiceFailure.Network) }
        val viewModel = viewModel()
        advanceUntilIdle()

        viewModel.setEnabled("exa", true)
        assertTrue(viewModel.providers.single { it.id == "exa" }.enabled)
        advanceUntilIdle()

        assertFalse(viewModel.providers.single { it.id == "exa" }.enabled)
        assertEquals(errorText(ServiceFailure.Network), viewModel.error)
    }

    @Test
    fun movesSendTheCompleteOrderAndStoreTheReturnedProviders() = runTest {
        client.onSetWebProviderOrder = { function, ids ->
            stored.map {
                when (function) {
                    ClientWebFunction.Search -> it.copy(searchRank = ids.indexOf(it.id))
                    ClientWebFunction.Fetch -> it.copy(fetchRank = ids.indexOf(it.id))
                }
            }
        }
        val viewModel = viewModel()
        advanceUntilIdle()

        viewModel.move(ClientWebFunction.Search, "exa", -1)
        advanceUntilIdle()
        assertEquals(
            Call("setWebProviderOrder", ClientWebFunction.Search, listOf("exa", "deepseek")),
            client.calls.last(),
        )
        assertEquals(listOf("exa", "deepseek"), viewModel.searchProviders.map { it.id })

        viewModel.move(ClientWebFunction.Fetch, "native", -1)
        advanceUntilIdle()
        assertEquals(
            Call(
                "setWebProviderOrder",
                ClientWebFunction.Fetch,
                listOf("deepseek", "native", "exa"),
            ),
            client.calls.last(),
        )
        assertEquals(listOf("deepseek", "native", "exa"), viewModel.fetchProviders.map { it.id })
    }

    @Test
    fun unknownAndBoundaryMovesAreIgnored() = runTest {
        val viewModel = viewModel()
        advanceUntilIdle()

        viewModel.move(ClientWebFunction.Search, "missing", 1)
        viewModel.move(ClientWebFunction.Search, "deepseek", -1)
        viewModel.move(ClientWebFunction.Fetch, "native", 1)
        advanceUntilIdle()

        assertEquals(0, client.calls.count { it.name == "setWebProviderOrder" })
    }

    @Test
    fun aFailedMoveShowsItsReasonWithoutChangingTheOrder() = runTest {
        client.onSetWebProviderOrder = { _, _ -> throw ServiceException(ServiceFailure.Network) }
        val viewModel = viewModel()
        advanceUntilIdle()
        val before = viewModel.providers

        viewModel.move(ClientWebFunction.Search, "exa", -1)
        advanceUntilIdle()

        assertEquals(before, viewModel.providers)
        assertEquals(errorText(ServiceFailure.Network), viewModel.error)
    }
}

private fun native() =
    ClientWebProvider("native", ClientWebProviderKind.Native, "Native", true, "", 0, 2)

private fun exa() =
    ClientWebProvider("exa", ClientWebProviderKind.Exa, "Exa", false, "sk-exa", 1, 1)

private fun deepSeek() =
    ClientWebProvider("deepseek", ClientWebProviderKind.DeepSeek, "DeepSeek", false, "", 0, 0)

private fun ClientWebProvider.patched(patch: ClientWebProviderPatch) =
    copy(
        enabled = if (patch.apiKey == "") false else patch.enabled ?: enabled,
        apiKey = patch.apiKey ?: apiKey,
    )
