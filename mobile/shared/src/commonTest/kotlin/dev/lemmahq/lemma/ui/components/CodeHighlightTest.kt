package dev.lemmahq.lemma.ui.components

import dev.snipme.highlights.model.SyntaxLanguage
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class CodeHighlightTest {

    @Test
    fun fenceNamesPickTheirGrammarAndOthersTheDefault() {
        assertEquals(
            listOf(
                SyntaxLanguage.SHELL,
                SyntaxLanguage.KOTLIN,
                SyntaxLanguage.DEFAULT,
                SyntaxLanguage.DEFAULT,
            ),
            listOf(" Bash ", "kotlin", "brainfuck", null).map(::syntaxLanguage),
        )
    }

    @Test
    fun tokensAreColoredAndTheTextIsKept() {
        val highlighted = highlightCode("val answer = 42", "kotlin", dark = false)

        assertEquals("val answer = 42", highlighted.text)
        assertTrue(highlighted.spanStyles.isNotEmpty())
    }
}
