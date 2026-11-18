package dev.lemmahq.lemma.ui.webprovider

import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import dev.lemmahq.lemma.client.ClientWebFunction
import dev.lemmahq.lemma.client.ClientWebProvider
import dev.lemmahq.lemma.client.ClientWebProviderKind
import dev.lemmahq.lemma.client.ClientWebProviderPatch
import dev.lemmahq.lemma.client.FakeLemmaClient
import dev.lemmahq.lemma.client.FakeLemmaClient.Call
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.theme.LemmaTheme
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.coroutines.CompletableDeferred
import org.junit.Rule
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class WebProviderScreenTest {

    @get:Rule val compose = createComposeRule()

    private val stored = mutableListOf(native(), exa(), deepSeek())
    private val client = FakeLemmaClient()

    private fun showScreen(onBack: () -> Unit = {}) {
        client.onListWebProviders = { stored.toList() }
        client.onUpdateWebProvider = { id, patch ->
            val index = stored.indexOfFirst { it.id == id }
            stored[index].patched(patch).also { stored[index] = it }
        }
        client.onSetWebProviderOrder = { _, _ -> stored.toList() }
        val viewModel = WebProviderViewModel(client)
        compose.setContent { LemmaTheme { WebProviderScreen(viewModel, onBack) } }
    }

    @Test
    fun backendsSaveKeysToggleAndMoveThroughTheClient() {
        showScreen()

        compose.onNodeWithText("Web Search & Fetch").assertIsDisplayed()
        compose.onAllNodes(hasSetTextAction())[0].assertIsDisplayed()
        compose
            .onNodeWithText("Save an API key before enabling this provider.")
            .performScrollTo()
            .assertIsDisplayed()
        compose
            .onNodeWithText(
                "Fetches pages directly on this device and extracts their text. No API key required."
            )
            .performScrollTo()
            .assertIsDisplayed()
        compose.onAllNodes(hasSetTextAction()).assertCountEquals(2)
        compose.onNodeWithText("Enable DeepSeek").performScrollTo().assertIsNotEnabled()

        compose.onNodeWithText("Enable Exa").performScrollTo().performClick()
        compose.onNodeWithText("Enable Native").performScrollTo().performClick()
        assertEquals(
            listOf(
                Call("updateWebProvider", "exa", ClientWebProviderPatch(enabled = true)),
                Call("updateWebProvider", "native", ClientWebProviderPatch(enabled = false)),
            ),
            client.calls.filter { it.name == "updateWebProvider" },
        )

        compose
            .onAllNodes(hasSetTextAction())[0]
            .performScrollTo()
            .performTextReplacement("  sk-screen  ")
        compose.onNodeWithText("Save").performScrollTo().performClick()
        assertEquals(
            Call("updateWebProvider", "exa", ClientWebProviderPatch(apiKey = "sk-screen")),
            client.calls.last(),
        )
        compose.onNodeWithText("You have unsaved changes.").assertDoesNotExist()

        compose.onAllNodes(hasSetTextAction())[1].performScrollTo().performTextInput("sk-discard")
        compose.onNodeWithText("Cancel").performScrollTo().performClick()
        compose.onNodeWithText("You have unsaved changes.").assertDoesNotExist()

        compose.onAllNodesWithContentDescription("Move Exa up")[0].performScrollTo().performClick()
        assertEquals(
            Call("setWebProviderOrder", ClientWebFunction.Search, listOf("exa", "deepseek")),
            client.calls.last(),
        )
        compose.onNodeWithContentDescription("Move Native up").performScrollTo().performClick()
        assertEquals(
            Call(
                "setWebProviderOrder",
                ClientWebFunction.Fetch,
                listOf("deepseek", "native", "exa"),
            ),
            client.calls.last(),
        )
        compose.onAllNodesWithContentDescription("Move DeepSeek up")[0].assertIsNotEnabled()
        compose.onAllNodesWithContentDescription("Move Exa down")[0].assertIsNotEnabled()
        compose.onNodeWithContentDescription("Move Native down").assertIsNotEnabled()
    }

    @Test
    fun loadingFailuresAndBackNavigationAreVisible() {
        val loaded = CompletableDeferred<List<ClientWebProvider>>()
        client.onListWebProviders = { loaded.await() }
        var backed = false
        val viewModel = WebProviderViewModel(client)
        compose.setContent {
            LemmaTheme { WebProviderScreen(viewModel, onBack = { backed = true }) }
        }
        compose.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate)).assertExists()
        compose.onNodeWithContentDescription("Back").performClick()
        assertTrue(backed)
        loaded.complete(emptyList())
        compose.onNodeWithText("Backends").assertIsDisplayed()
    }

    @Test
    fun loadFailureShowsItsReason() {
        client.onListWebProviders = { throw ServiceException(ServiceFailure.Network) }
        val viewModel = WebProviderViewModel(client)
        compose.setContent { LemmaTheme { WebProviderScreen(viewModel, onBack = {}) } }
        compose.onNodeWithText("Connection failed, try again").assertIsDisplayed()
    }

    @Test
    fun updateFailureShowsItsReason() {
        showScreen()
        client.onUpdateWebProvider = { _, _ -> throw ServiceException(ServiceFailure.Network) }
        compose.onNodeWithText("Enable Exa").performScrollTo().performClick()
        compose.onNodeWithText("Connection failed, try again").assertIsDisplayed()
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
