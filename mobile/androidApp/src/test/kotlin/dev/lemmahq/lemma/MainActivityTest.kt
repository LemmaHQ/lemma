package dev.lemmahq.lemma

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import dev.lemmahq.lemma.data.ThemePreference
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class MainActivityTest {

    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Test
    fun theAppOpensAtSetupAndKeepsItsScreenAcrossThemes() {
        compose.onNodeWithText("Run locally on this device").assertIsDisplayed()

        val application = compose.activity.application as LemmaApplication
        compose.runOnUiThread { application.settings.setTheme(ThemePreference.Dark) }

        compose.onNodeWithText("Run locally on this device").assertIsDisplayed()
    }
}
