package dev.lemmahq.lemma.ui.components

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import dev.lemmahq.lemma.theme.LemmaTheme
import kotlin.test.Test
import org.junit.Rule
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class LemmaCodeTest {

    @get:Rule val compose = createComposeRule()

    @Test
    fun theWholeCodeShowsWhileItsHighlightCatchesUp() {
        var code by mutableStateOf("val a = 1")
        compose.setContent { LemmaTheme { LemmaCode(code = code, language = "kotlin") } }
        compose.onNodeWithText("val a = 1").assertExists()

        code = "val a = 1\nval b = 2"
        compose.onNodeWithText("val a = 1\nval b = 2").assertExists()

        code = "fun main() {}"
        compose.onNodeWithText("fun main() {}").assertExists()
    }
}
