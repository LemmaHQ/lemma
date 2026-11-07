package dev.lemmahq.lemma.ui.components

import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.TextLayoutResult
import dev.lemmahq.lemma.theme.LemmaTheme
import kotlin.test.Test
import kotlin.test.assertEquals
import org.junit.Rule
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

private const val PASSWORD = "password-1"

@RunWith(RobolectricTestRunner::class)
class LemmaPasswordFieldTest {

    @get:Rule val compose = createComposeRule()

    @Test
    fun theEyeToggleShowsAndMasksThePassword() {
        compose.setContent {
            LemmaTheme {
                LemmaPasswordField(value = PASSWORD, onValueChange = {}, placeholder = "Password")
            }
        }
        val field = compose.onNode(hasSetTextAction())
        val masked = "\u2022".repeat(PASSWORD.length)

        field.assert(SemanticsMatcher.expectValue(SemanticsProperties.Password, Unit))
        assertEquals(masked, field.shownText())
        compose.onNodeWithContentDescription("Show").performClick()
        assertEquals(PASSWORD, field.shownText())
        compose.onNodeWithContentDescription("Hide").performClick()
        assertEquals(masked, field.shownText())
    }
}

private fun SemanticsNodeInteraction.shownText(): String {
    val layouts = mutableListOf<TextLayoutResult>()
    performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
    return layouts.single().layoutInput.text.text
}
