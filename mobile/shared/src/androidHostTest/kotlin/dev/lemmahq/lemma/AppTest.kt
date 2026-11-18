package dev.lemmahq.lemma

import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.russhwolf.settings.MapSettings
import dev.lemmahq.lemma.client.FakeEngineOpener
import dev.lemmahq.lemma.client.FakeLemmaClient
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.data.LanguagePreference
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.data.ThemePreference
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.coroutines.CompletableDeferred
import org.junit.Rule
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class AppTest {

    @get:Rule val compose = createComposeRule()

    private val settings = SettingsRepository(MapSettings())
    private val client = FakeLemmaClient()

    @Test
    fun opensIntoSessionAndNavigatesSettings() {
        val opening = CompletableDeferred<Unit>()
        val engineOpener =
            FakeEngineOpener(client).apply {
                onOpen = {
                    opening.await()
                    client
                }
            }
        compose.setContent { App(settings, engineOpener) }

        compose.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate)).assertExists()
        opening.complete(Unit)
        compose.onNodeWithText("How can I help you today?").assertIsDisplayed()

        compose.onNodeWithContentDescription("Show sessions").performClick()
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
        compose.onNodeWithText("Web Search & Fetch").performClick()
        compose.onNodeWithText("Backends").assertIsDisplayed()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithText("How can I help you today?").assertIsDisplayed()
    }

    @Test
    fun aFailedEngineStartShowsRetryAndRecovers() {
        var fail = true
        val engineOpener =
            FakeEngineOpener(client).apply {
                onOpen = {
                    if (fail) throw ServiceException(ServiceFailure.Unspecified)
                    client
                }
            }
        compose.setContent { App(settings, engineOpener) }

        compose.onNodeWithText("The engine could not start.").assertIsDisplayed()
        fail = false
        compose.onNodeWithText("Retry").performClick()

        compose.onNodeWithText("How can I help you today?").assertIsDisplayed()
    }
}
