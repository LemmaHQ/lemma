package io.github.mistvesper.lemma.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.theme.LemmaTheme

/** An indeterminate ring for work in progress, sized like a 14 dp icon. */
@Composable
fun LemmaSpinner(modifier: Modifier = Modifier) {
    val color = LemmaTheme.colors.brand
    CircularProgressIndicator(
        color = color,
        trackColor = color.copy(alpha = 0.22f),
        strokeWidth = 1.6.dp,
        modifier = modifier.size(14.dp),
    )
}
