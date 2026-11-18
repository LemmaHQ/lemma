package io.github.mistvesper.lemma.ui.components

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import kotlin.test.Test
import org.junit.Rule
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class LemmaMarkdownTest {

    @get:Rule val compose = createComposeRule()

    @Test
    fun codeFenceRendersOnlyItsOwnCode() {
        val firstCode = "val first = 1"
        val secondCode = "val second = 2"
        val content =
            """
            Before the fences.

            ```kotlin
            $firstCode
            ```

            Between the fences.

            ```
            $secondCode
            ```

            After the fences.
            """
                .trimIndent()

        compose.setContent { LemmaMarkdown(content) }
        compose.waitUntil {
            compose.onAllNodesWithText("After the fences.").fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithText(firstCode, substring = true).assertExists()
        compose.onNodeWithText(secondCode, substring = true).assertExists()
        compose.onNodeWithText("Before the fences.").assertExists()
        compose.onNodeWithText("Between the fences.").assertExists()
        compose.onNodeWithText("After the fences.").assertExists()
        compose
            .onNode(
                hasText(firstCode, substring = true) and
                    hasText("Before the fences.", substring = true)
            )
            .assertDoesNotExist()
        compose
            .onNode(hasText(firstCode, substring = true) and hasText(secondCode, substring = true))
            .assertDoesNotExist()
    }

    @Test
    fun anIndentedCodeBlockRendersAsCode() {
        compose.setContent { LemmaMarkdown("Run this:\n\n    ./gradlew check\n\nThen wait.") }
        compose.waitUntil {
            compose.onAllNodesWithText("Then wait.").fetchSemanticsNodes().isNotEmpty()
        }

        compose.onNodeWithText("./gradlew check", substring = true).assertExists()
        compose.onNodeWithText("Open").assertDoesNotExist()
    }

    @Test
    fun aTableShowsItsHeaderAndEveryRow() {
        compose.setContent {
            LemmaMarkdown("| Name | Count |\n| --- | --- |\n| apples | 3 |\n| pears | 12 |\n\nEnd.")
        }
        compose.waitUntil { compose.onAllNodesWithText("End.").fetchSemanticsNodes().isNotEmpty() }

        for (cell in listOf("Name", "Count", "apples", "3", "pears", "12")) {
            compose.onNode(hasTrimmedText(cell)).assertExists()
        }
    }

    private fun hasTrimmedText(text: String) =
        SemanticsMatcher("text trimmed is '$text'") { node ->
            node.config.getOrNull(SemanticsProperties.Text).orEmpty().any { it.text.trim() == text }
        }

    @Test
    fun aQuoteShowsItsParagraphs() {
        compose.setContent { LemmaMarkdown("> First thought\n>\n> Second thought\n\nEnd.") }
        compose.waitUntil { compose.onAllNodesWithText("End.").fetchSemanticsNodes().isNotEmpty() }

        compose.onNodeWithText("First thought").assertExists()
        compose.onNodeWithText("Second thought").assertExists()
    }
}
