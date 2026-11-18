package io.github.mistvesper.lemma

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import io.github.mistvesper.lemma.data.ThemePreference
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class MainActivityTest {

    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Test
    fun theAppOpensASessionAndKeepsItsScreenAcrossThemes() {
        compose.waitUntil(timeoutMillis = 10_000) {
            compose
                .onAllNodesWithText("How can I help you today?")
                .fetchSemanticsNodes()
                .isNotEmpty()
        }
        compose.onNodeWithText("How can I help you today?").assertIsDisplayed()

        val application = compose.activity.application as LemmaApplication
        compose.runOnUiThread { application.settings.setTheme(ThemePreference.Dark) }

        compose.onNodeWithText("How can I help you today?").assertIsDisplayed()
    }
}
