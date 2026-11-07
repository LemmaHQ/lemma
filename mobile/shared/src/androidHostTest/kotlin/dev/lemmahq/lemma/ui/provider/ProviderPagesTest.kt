package dev.lemmahq.lemma.ui.provider

import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.isEnabled
import androidx.compose.ui.test.isPopup
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.rememberNavController
import androidx.test.espresso.Espresso
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.ClientProviderPatch
import dev.lemmahq.lemma.client.FakeLemmaClient
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.client.sampleProvider
import dev.lemmahq.lemma.theme.LemmaTheme
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.coroutines.CompletableDeferred
import org.junit.Rule
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ProviderPagesTest {

    @get:Rule val compose = createComposeRule()

    private val stored = mutableListOf<ClientProvider>()
    private val client =
        FakeLemmaClient().apply {
            onListProviders = { stored.toList() }
            onCreateProvider = { input ->
                ClientProvider(
                        id = "provider-${stored.size + 1}",
                        kind = input.kind,
                        identifier = input.identifier,
                        name = input.name,
                        baseUrl = input.baseUrl,
                        apiPath = input.apiPath,
                        modelsPath = input.modelsPath,
                        models = input.models,
                        enabled = true,
                        apiKey = input.apiKey,
                    )
                    .also { stored += it }
            }
            onDeleteProvider = { id -> stored.removeAll { it.id == id } }
        }

    private lateinit var navController: NavHostController

    private fun showProviders() {
        compose.setContent {
            navController = rememberNavController()
            LemmaTheme {
                NavHost(navController = navController, startDestination = ProviderGraph) {
                    providerGraph(navController) { client }
                }
            }
        }
    }

    private fun openStoredProvider(vararg models: String) {
        stored += sampleProvider("p1", *models)
        client.onUpdateProvider = { id, patch ->
            val index = stored.indexOfFirst { it.id == id }
            stored[index].patched(patch).also { stored[index] = it }
        }
        showProviders()
        compose.onNodeWithText("p1").performClick()
    }

    private fun inDialog(matcher: SemanticsMatcher) =
        compose.onNode(matcher and hasAnyAncestor(isDialog()))

    @Test
    fun aCreatedProviderOpensAndUnsavedChangesAskBeforeLeaving() {
        showProviders()

        compose.onNodeWithText("No providers yet.").assertIsDisplayed()
        compose.onNodeWithContentDescription("New provider").performClick()
        val fields = compose.onAllNodes(hasSetTextAction())
        fields[0].performTextInput("my-proxy")
        fields[2].performTextInput("sk-test")
        fields[3].performTextInput("https://api.example.com/v1")
        compose.onNodeWithText("Save").performClick()

        compose.onNodeWithText("my-proxy").assertIsDisplayed()
        compose.onNodeWithText("Enable provider").assertIsDisplayed()
        assertEquals("sk-test", stored.single().apiKey)

        compose
            .onNode(hasText("https://api.example.com/v1") and hasSetTextAction())
            .performScrollTo()
            .performTextReplacement("https://proxy.example.com/v1")
        compose.onNodeWithText("You have unsaved changes.").assertIsDisplayed()
        Espresso.pressBack()
        compose.onNodeWithText("Keep editing").performClick()
        compose.onNodeWithText("You have unsaved changes.").assertIsDisplayed()
        Espresso.pressBack()
        compose.onNodeWithText("Discard").performClick()

        compose.onNodeWithText("Enabled").assertIsDisplayed()
        assertEquals("https://api.example.com/v1", stored.single().baseUrl)
        compose.onNodeWithText("my-proxy").performClick()
        compose.onNodeWithContentDescription("More actions").performClick()
        compose.onNodeWithText("Delete provider").performClick()
        compose.onNodeWithText("Delete").performClick()

        compose.onNodeWithText("No providers yet.").assertIsDisplayed()
        assertEquals(emptyList(), stored)
    }

    @Test
    fun theSettingsDialogRenamesTheProviderOnceTheServiceAccepts() {
        openStoredProvider("gpt-4o")
        val update = client.onUpdateProvider
        client.onUpdateProvider = { _, _ -> throw ServiceException(ServiceFailure.Network) }

        compose.onNodeWithContentDescription("More actions").performClick()
        compose.onNodeWithText("Provider settings").performClick()
        inDialog(hasText("p1") and hasSetTextAction() and isEnabled())
            .performTextReplacement("Work")
        inDialog(hasText("Save")).performClick()
        inDialog(hasText("Cannot reach the server, check your connection and try again"))
            .assertIsDisplayed()
        client.onUpdateProvider = update
        inDialog(hasText("Save")).performClick()

        compose.onNode(isDialog()).assertDoesNotExist()
        compose.onNodeWithText("Work").assertIsDisplayed()
        compose.onNodeWithContentDescription("More actions").performClick()
        compose.onNodeWithText("Provider settings").performClick()
        inDialog(hasText("Cancel")).performClick()
        compose.onNode(isDialog()).assertDoesNotExist()
    }

    @Test
    fun fetchedModelsArePickedAndTheModelListIsEdited() {
        client.onFetchProviderModels = { listOf("gpt-4o", "o3", "o4-mini") }
        openStoredProvider("gpt-4o")

        compose.onNodeWithText("Fetch model list").performScrollTo().performClick()
        inDialog(hasSetTextAction()).performTextInput("zzz")
        inDialog(hasText("No models match the current filter.")).assertIsDisplayed()
        inDialog(hasSetTextAction()).performTextReplacement("")
        inDialog(hasText("Select all")).performClick()
        inDialog(hasText("Add 2 models")).assertIsDisplayed()
        inDialog(hasText("Select all")).performClick()
        inDialog(hasText("o4-mini")).performClick()
        inDialog(hasText("o4-mini")).performClick()
        inDialog(hasText("o3")).performClick()
        inDialog(hasText("Add 1 model")).performClick()
        compose.onNodeWithText("Fetch model list").performClick()
        inDialog(hasContentDescription("Back")).performClick()
        compose.onNode(isDialog()).assertDoesNotExist()
        assertEquals(listOf("gpt-4o", "o3"), stored.single().models)

        compose.onAllNodesWithContentDescription("Remove model")[0].performScrollTo().performClick()
        assertEquals(listOf("o3"), stored.single().models)
        compose.onNodeWithContentDescription("Add model").performScrollTo().performClick()
        compose.onAllNodes(hasSetTextAction()).onLast().performTextInput("custom")
        compose.onAllNodesWithContentDescription("Add model")[1].performScrollTo().performClick()
        compose.onNodeWithContentDescription("Add model").performScrollTo().performClick()
        compose.onNodeWithContentDescription("Cancel").performScrollTo().performClick()

        compose.onNodeWithContentDescription("Cancel").assertDoesNotExist()
        assertEquals(listOf("custom", "o3"), stored.single().models)
    }

    @Test
    fun theCheckUsesThePickedModelAndFailedRequestsShowTheirReason() {
        client.onCheckProvider = { _, _, _ -> throw ServiceException(ServiceFailure.Network) }
        openStoredProvider("gpt-4o", "o3")
        val failure = "Cannot reach the server, check your connection and try again"

        compose
            .onNode(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.DropdownList))
            .performScrollTo()
            .performClick()
        compose.onNode(hasText("o3") and hasAnyAncestor(isPopup())).performClick()
        compose.onNodeWithText("Check").performClick()
        compose.onNodeWithText(failure).assertExists()
        assertEquals("o3", (client.calls.last().args[2]))

        client.onUpdateProvider = { _, _ -> throw ServiceException(ServiceFailure.Timeout) }
        compose
            .onNode(hasText("https://api.example.com/v1") and hasSetTextAction())
            .performScrollTo()
            .performTextReplacement("https://proxy.example.com/v1")
        compose.onNodeWithText("Save").performClick()
        compose.onNodeWithText("The request timed out, please try again").assertExists()
    }

    @Test
    fun theListWaitsForTheProvidersAndGroupsThemByState() {
        val providers = CompletableDeferred<List<ClientProvider>>()
        client.onListProviders = { providers.await() }
        showProviders()

        compose.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate)).assertExists()
        providers.complete(
            listOf(
                sampleProvider("p1"),
                sampleProvider("p2"),
                sampleProvider("p3", enabled = false),
            )
        )

        compose.onNodeWithText("Enabled").assertIsDisplayed()
        compose.onNodeWithText("Disabled").assertIsDisplayed()
        compose.onNodeWithText("p2").assertIsDisplayed()
    }

    @Test
    fun aFailedListShowsItsReason() {
        client.onListProviders = { throw ServiceException(ServiceFailure.Network) }
        showProviders()

        compose
            .onNodeWithText("Cannot reach the server, check your connection and try again")
            .assertIsDisplayed()
    }

    @Test
    fun aProviderPageWaitsForTheListAndLeavesWhenTheProviderIsGone() {
        val providers = CompletableDeferred<List<ClientProvider>>()
        client.onListProviders = { providers.await() }
        showProviders()

        compose.runOnUiThread { navController.navigate(ProviderDetailRoute("gone")) }
        compose.onNodeWithText("AI Providers").assertIsDisplayed()
        compose.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate)).assertExists()
        providers.complete(emptyList())

        compose.onNodeWithText("No providers yet.").assertIsDisplayed()
    }

    @Test
    fun theNewProviderFormShowsAnInvalidAddressAndARejection() {
        client.onCreateProvider = { throw ServiceException(ServiceFailure.ProviderIdentifierTaken) }
        showProviders()

        compose.onNodeWithContentDescription("New provider").performClick()
        val fields = compose.onAllNodes(hasSetTextAction())
        fields[0].performTextInput("openai")
        fields[3].performTextInput("api.example.com")
        compose.onNodeWithText("Must start with http:// or https://.").assertExists()
        fields[3].performTextReplacement("https://api.example.com/v1")
        compose.onNodeWithText("Save").performClick()

        compose.onNodeWithText("This provider ID is already taken").assertExists()
    }
}

private fun ClientProvider.patched(patch: ClientProviderPatch): ClientProvider =
    copy(
        name = patch.name ?: name,
        baseUrl = patch.baseUrl ?: baseUrl,
        apiKey = patch.apiKey ?: apiKey,
        apiPath = patch.apiPath ?: apiPath,
        enabled = patch.enabled ?: enabled,
        models = patch.models ?: models,
    )
