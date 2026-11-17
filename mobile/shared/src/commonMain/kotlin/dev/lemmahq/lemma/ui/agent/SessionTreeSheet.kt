package dev.lemmahq.lemma.ui.agent

import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaBottomSheet
import dev.lemmahq.lemma.ui.components.LemmaTextField
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_search
import lemma.mobile.shared.generated.resources.session_tree_add_label
import lemma.mobile.shared.generated.resources.session_tree_button
import lemma.mobile.shared.generated.resources.session_tree_edit_label
import lemma.mobile.shared.generated.resources.session_tree_empty
import lemma.mobile.shared.generated.resources.session_tree_hint_touch
import lemma.mobile.shared.generated.resources.session_tree_search_placeholder
import org.jetbrains.compose.resources.pluralStringResource
import org.jetbrains.compose.resources.stringResource

/**
 * The session [tree] in a sheet titled with its path count, with a search field and filters above
 * its rows. Linear runs share one column and the rows below a fork indent; the shown path comes
 * first with brand dots and its leaf a completion square, while the other branches fade. Tapping a
 * row calls [onSelect] while [navigable]; a long press edits its label for [onSaveLabel], where an
 * empty label clears it.
 */
@Composable
internal fun SessionTreeSheet(
    tree: SessionTree,
    navigable: Boolean,
    onSelect: (TreeRow) -> Unit,
    onSaveLabel: (id: String, label: String) -> Unit,
    onDismiss: () -> Unit,
) {
    var query by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf(TreeFilter.All) }
    var editingId by rememberSaveable { mutableStateOf<String?>(null) }
    val titles = tree.rows.map { it.title.text() }
    val needle = query.trim()
    val visible = tree.rows.zip(titles).filter { (row, title) -> filter.shows(row, title, needle) }

    LemmaBottomSheet(
        onDismiss = onDismiss,
        title =
            pluralStringResource(Res.plurals.session_tree_button, tree.pathCount, tree.pathCount),
    ) {
        Text(
            text = stringResource(Res.string.session_tree_hint_touch),
            style = LemmaTheme.typography.caption,
            color = LemmaTheme.colors.subtleForeground,
        )
        Spacer(modifier = Modifier.height(8.dp))
        LemmaTextField(
            value = query,
            onValueChange = { query = it },
            placeholder = stringResource(Res.string.session_tree_search_placeholder),
            leadingIcon = Res.drawable.icon_search,
        )
        Row(
            modifier = Modifier.padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            TreeFilter.entries.forEach {
                FilterChip(
                    text = stringResource(it.label),
                    selected = it == filter,
                    onClick = { filter = it },
                )
            }
        }
        if (visible.isEmpty()) {
            Text(
                text = stringResource(Res.string.session_tree_empty),
                style = LemmaTheme.typography.small,
                color = LemmaTheme.colors.mutedForeground,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
            )
        } else {
            LazyColumn(modifier = Modifier.weight(1f, fill = false)) {
                items(visible, key = { (row) -> row.id }) { (row, title) ->
                    TreeRowItem(
                        row = row,
                        title = title,
                        onClick = { if (navigable) onSelect(row) },
                        onLongClick = { editingId = row.id },
                    )
                }
            }
        }
    }

    tree.rows
        .firstOrNull { it.id == editingId }
        ?.let { row ->
            TreeLabelDialog(
                label = row.label,
                onSave = { label ->
                    onSaveLabel(row.id, label)
                    editingId = null
                },
                onDismiss = { editingId = null },
            )
        }
}

@Composable
private fun FilterChip(text: String, selected: Boolean, onClick: () -> Unit) {
    Text(
        text = text,
        style = LemmaTheme.typography.caption,
        color = if (selected) LemmaTheme.colors.foreground else LemmaTheme.colors.mutedForeground,
        modifier =
            Modifier.clip(LemmaTheme.shapes.sm)
                .background(if (selected) LemmaTheme.colors.selected else Color.Transparent)
                .selectable(selected = selected, onClick = onClick, role = Role.Tab)
                .padding(horizontal = 10.dp, vertical = 4.dp),
    )
}

@Composable
private fun TreeRowItem(row: TreeRow, title: String, onClick: () -> Unit, onLongClick: () -> Unit) {
    Row(
        modifier =
            Modifier.fillMaxWidth()
                .heightIn(min = 32.dp)
                .clip(LemmaTheme.shapes.sm)
                .combinedClickable(
                    role = Role.Button,
                    onLongClickLabel =
                        stringResource(
                            if (row.label == null) Res.string.session_tree_add_label
                            else Res.string.session_tree_edit_label
                        ),
                    onLongClick = onLongClick,
                    onClick = onClick,
                )
                .padding(start = 6.dp + 16.dp * row.depth, end = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier.size(6.dp)
                    .clip(if (row.isLeaf && row.onPath) RectangleShape else CircleShape)
                    .background(
                        when {
                            !row.onPath -> LemmaTheme.colors.input
                            row.isLeaf -> LemmaTheme.colors.completion
                            else -> LemmaTheme.colors.brand
                        }
                    )
        )
        Text(
            text = title,
            style = LemmaTheme.typography.small,
            color =
                when {
                    !row.onPath -> LemmaTheme.colors.subtleForeground
                    row.question -> LemmaTheme.colors.foreground
                    else -> LemmaTheme.colors.mutedForeground
                },
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        row.label?.let {
            Text(
                text = it,
                style = LemmaTheme.typography.caption,
                color = LemmaTheme.colors.foreground,
                maxLines = 1,
                modifier =
                    Modifier.clip(LemmaTheme.shapes.sm)
                        .background(LemmaTheme.colors.selected)
                        .padding(horizontal = 6.dp, vertical = 1.dp),
            )
        }
    }
}
