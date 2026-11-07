package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme

/** An indeterminate ring for work in progress, sized like the icon it stands in for. */
@Composable
fun LemmaSpinner(
    modifier: Modifier = Modifier,
    size: Dp = 14.dp,
    color: Color = LemmaTheme.colors.textSecondary,
) {
    CircularProgressIndicator(
        color = color,
        trackColor = color.copy(alpha = 0.22f),
        strokeWidth = 1.6.dp,
        modifier = modifier.size(size),
    )
}
