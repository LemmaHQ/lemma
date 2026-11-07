package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.material3.DropdownMenu
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import dev.lemmahq.lemma.theme.LemmaTheme

@Composable
fun LemmaDropdownMenu(
    expanded: Boolean,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    DropdownMenu(
        expanded = expanded,
        onDismissRequest = onDismiss,
        modifier = modifier,
        shape = LemmaTheme.shapes.medium,
        containerColor = LemmaTheme.colors.backgroundGroup,
        content = content,
    )
}
