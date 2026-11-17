package dev.lemmahq.lemma.ui.components

import kotlin.test.Test
import kotlin.test.assertEquals
import org.intellij.markdown.ast.ASTNode
import org.intellij.markdown.flavours.gfm.GFMElementTypes
import org.intellij.markdown.flavours.gfm.GFMFlavourDescriptor
import org.intellij.markdown.parser.CancellationToken
import org.intellij.markdown.parser.MarkdownParser

class MarkdownTableBlockTest {

    private fun table(markdown: CharSequence): ASTNode {
        val parser =
            MarkdownParser(
                GFMFlavourDescriptor(),
                cancellationToken = CancellationToken.NonCancellable,
            )
        val root = parser.buildMarkdownTreeFromString(markdown)
        return root.children.single { it.type == GFMElementTypes.TABLE }
    }

    @Test
    fun columnsOfNumbersAlignToTheEndAndTextOrBlankColumnsDoNot() {
        val markdown =
            """
            | Item | Price | Share | Note | Gap |
            | --- | --- | --- | --- | --- |
            | jam | 3 |
            | tea | $4.50 | 12% | 1 cup |  |
            | rice | -1,200 |  | 2 |  |
            """
                .trimIndent()

        assertEquals(setOf(1, 2), numericColumns(table(markdown), markdown))
    }

    @Test
    fun aTableWithoutBodyRowsHasNoNumberColumns() {
        val markdown = "| A | B |\n| --- | --- |"

        assertEquals(emptySet(), numericColumns(table(markdown), markdown))
    }
}
