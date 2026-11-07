package dev.lemmahq.lemma

import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import com.russhwolf.settings.MapSettings
import dev.lemmahq.lemma.client.Connection
import dev.lemmahq.lemma.client.FakeConnector
import dev.lemmahq.lemma.client.FakeLemmaClient
import dev.lemmahq.lemma.client.FakeLemmaClient.Call
import dev.lemmahq.lemma.data.DriverFactory
import dev.lemmahq.lemma.data.InMemoryTokenStore
import dev.lemmahq.lemma.data.LanguagePreference
import dev.lemmahq.lemma.data.LocalMessageRepository
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.data.ThemePreference
import dev.lemmahq.lemma.db.LemmaDatabase
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.awaitCancellation
import org.junit.Rule
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment

@RunWith(RobolectricTestRunner::class)
class AppTest {

    @get:Rule val compose = createComposeRule()

    private val settings = SettingsRepository(MapSettings(), InMemoryTokenStore())
    private val client =
        FakeLemmaClient().apply {
            onSignIn = { _, _ -> settings.setTokens("access-1", "refresh-1") }
            onSignOut = { settings.clearAuth() }
        }
    private val messageCache =
        LocalMessageRepository(
            LemmaDatabase(DriverFactory(RuntimeEnvironment.getApplication()).createDriver())
        )

    @Test
    fun settingsApplyPreferencesAndAccountMenuSignsOut() {
        compose.setContent { App(settings, messageCache, FakeConnector(client), "9.9.9") }

        compose.onNodeWithText("Run locally on this device").performClick()
        compose.onNodeWithText("Sign in to Lemma").assertIsDisplayed()
        compose.onNodeWithText("Server v1.0.0 · Client v9.9.9").assertIsDisplayed()
        compose.onNode(hasSetTextAction()).performTextInput("ada")
        compose.onNodeWithText("Continue").performClick()
        compose.onNodeWithText("Enter your password").assertIsDisplayed()
        compose.onNode(hasSetTextAction()).performTextInput("password-1")
        compose.onNodeWithText("Sign in").performClick()
        compose.onNodeWithText("How can I help you today?").assertIsDisplayed()
        assertEquals(
            listOf(Call("checkAccount", "ada"), Call("signIn", "ada", "password-1")),
            client.calls.filter { it.name == "checkAccount" || it.name == "signIn" },
        )

        compose.onNodeWithContentDescription("Show sessions").performClick()
        compose.onNodeWithText("ada").performClick()
        compose.onNodeWithText("App settings").performClick()
        compose.onNodeWithText("Settings").assertIsDisplayed()

        compose.onNodeWithText("Appearance").performClick()
        compose.onNodeWithText("Dark").performClick()
        compose.onNodeWithText("Dark").assertIsSelected()
        assertEquals(ThemePreference.Dark, settings.theme.value)

        compose.onNodeWithText("中文").performScrollTo().performClick()
        compose.onNodeWithText("外观").assertIsDisplayed()
        assertEquals(LanguagePreference.Chinese, settings.language.value)
        compose.onNodeWithText("English").performScrollTo().performClick()
        compose.onNodeWithText("Appearance").assertIsDisplayed()
        assertEquals(LanguagePreference.English, settings.language.value)

        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithText("AI Providers").performClick()
        compose.onNodeWithText("No providers yet.").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithText("How can I help you today?").assertIsDisplayed()

        compose.onNodeWithContentDescription("Show sessions").performClick()
        compose.onNodeWithText("ada").performClick()
        compose.onNodeWithText("Sign out").performClick()
        compose.onNodeWithText("Sign in to Lemma").assertIsDisplayed()
        assertEquals(Call("signOut"), client.calls.last { it.name == "signOut" })
    }

    @Test
    fun aStoredConnectionShowsProgressWhileItOpens() {
        settings.setConnection(Connection.Local)
        val connector = FakeConnector(client).apply { onOpen = { awaitCancellation() } }

        compose.setContent { App(settings, messageCache, connector, "9.9.9") }

        compose.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate)).assertExists()
    }

    @Test
    fun aRemoteServerCanBeChangedAndAnUnknownAccountSignsUp() {
        client.onCheckAccount = { false }
        client.onSignUp = { _, _, _ -> settings.setTokens("access-1", "refresh-1") }
        val opening = CompletableDeferred<Unit>()
        val connector =
            FakeConnector(client).apply {
                onOpen = {
                    opening.await()
                    client
                }
            }
        compose.setContent { App(settings, messageCache, connector, "9.9.9") }

        compose.onNode(hasSetTextAction()).performTextReplacement("lemma.example.com")
        compose.onNodeWithText("Connect").performClick()
        compose
            .onNodeWithText("Enter a full address starting with http:// or https://.")
            .assertIsDisplayed()
        compose.onNode(hasSetTextAction()).performTextReplacement("https://lemma.example.com")
        compose.onNodeWithText("Connect").performClick()
        compose.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate)).assertExists()
        opening.complete(Unit)
        compose.onNodeWithText("Connected to https://lemma.example.com").assertIsDisplayed()
        compose.onNodeWithText("Change server").performClick()
        compose.onNodeWithText("Connect").performClick()

        compose.onNode(hasSetTextAction()).performTextInput("grace")
        compose.onNodeWithText("Continue").performClick()
        compose.onNodeWithText("Create your Lemma account").assertExists()
        val fields = compose.onAllNodes(hasSetTextAction())
        fields[1].performTextInput("grace@example.com")
        fields[2].performTextInput("password-1")
        fields[3].performTextInput("password-1")
        compose.onNodeWithText("Sign up").performClick()

        compose.onNodeWithText("How can I help you today?").assertIsDisplayed()
        assertEquals(
            Call("signUp", "grace", "grace@example.com", "password-1"),
            client.calls.last { it.name == "signUp" },
        )
    }

    @Test
    fun droppingTheConnectionLeavesThePagesThatNeedIt() {
        settings.setConnection(Connection.Local)
        settings.setTokens("access-1", "refresh-1")
        val connector = FakeConnector(client)
        val appViewModel = AppViewModel(settings, connector, messageCache)
        compose.setContent {
            App(settings, messageCache, connector, "9.9.9", appViewModel = appViewModel)
        }

        compose.onNodeWithContentDescription("Show sessions").performClick()
        compose.onNodeWithText("ada").performClick()
        compose.onNodeWithText("App settings").performClick()
        compose.onNodeWithText("AI Providers").performClick()
        compose.onNodeWithText("No providers yet.").assertIsDisplayed()
        compose.runOnUiThread { appViewModel.changeConnection() }

        compose.onNodeWithText("Run locally on this device").assertIsDisplayed()
    }
}
