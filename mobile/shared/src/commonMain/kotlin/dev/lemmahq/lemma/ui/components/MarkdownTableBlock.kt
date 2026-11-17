package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.mikepenz.markdown.compose.components.MarkdownComponentModel
import com.mikepenz.markdown.compose.elements.LocalTableRowIndex
import com.mikepenz.markdown.compose.elements.MarkdownDivider
import com.mikepenz.markdown.compose.elements.MarkdownTable
import com.mikepenz.markdown.compose.elements.MarkdownTableBasicText
import dev.lemmahq.lemma.theme.LemmaTheme
import org.intellij.markdown.ast.ASTNode
import org.intellij.markdown.ast.getTextInNode
import org.intellij.markdown.flavours.gfm.GFMElementTypes
import org.intellij.markdown.flavours.gfm.GFMTokenTypes

private val NUMBER = Regex("""[-+]?[$€£¥]?\d[\d,]*(\.\d+)?%?""")

/**
 * The markdown table in [model] inside a thin border, its header row on the selected fill and thin
 * lines between rows. Digits take tabular widths, and a column whose body cells are all numbers
 * aligns to the end.
 */
@Composable
internal fun MarkdownTableBlock(model: MarkdownComponentModel) {
    val numeric = remember(model.node, model.content) { numericColumns(model.node, model.content) }
    Box(
        modifier =
            Modifier.fillMaxWidth()
                .clip(LemmaTheme.shapes.md)
                .border(1.dp, LemmaTheme.colors.border, LemmaTheme.shapes.md)
    ) {
        MarkdownTable(
            content = model.content,
            node = model.node,
            style = model.typography.table.copy(fontFeatureSettings = "tnum"),
            headerBlock = { content, header, _, style ->
                TableRow(
                    content = content,
                    row = header,
                    numeric = numeric,
                    style =
                        style.copy(
                            color = LemmaTheme.colors.mutedForeground,
                            fontWeight = FontWeight.SemiBold,
                        ),
                    modifier =
                        Modifier.background(LemmaTheme.colors.selected).semantics { heading() },
                )
            },
            rowBlock = { content, row, _, style ->
                Column {
                    if (LocalTableRowIndex.current > 1) MarkdownDivider()
                    TableRow(content = content, row = row, numeric = numeric, style = style)
                }
            },
        )
    }
}

@Composable
private fun TableRow(
    content: String,
    row: ASTNode,
    numeric: Set<Int>,
    style: TextStyle,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        row.children
            .filter { it.type == GFMTokenTypes.CELL }
            .forEachIndexed { index, cell ->
                Column(
                    modifier = Modifier.weight(1f).padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalAlignment = if (index in numeric) Alignment.End else Alignment.Start,
                ) {
                    MarkdownTableBasicText(content = content, cell = cell, style = style)
                }
            }
    }
}

/** The indexes of the columns in [table] whose body cells, ignoring empty ones, are all numbers. */
internal fun numericColumns(table: ASTNode, content: String): Set<Int> {
    val rows =
        table.children
            .filter { it.type == GFMElementTypes.ROW }
            .map { row ->
                row.children
                    .filter { it.type == GFMTokenTypes.CELL }
                    .map { it.getTextInNode(content).trim().toString() }
            }
    val columnCount = rows.maxOfOrNull { it.size } ?: 0
    return (0 until columnCount).filterTo(mutableSetOf()) { column ->
        val cells = rows.mapNotNull { it.getOrNull(column) }.filter { it.isNotEmpty() }
        cells.isNotEmpty() && cells.all(NUMBER::matches)
    }
}
