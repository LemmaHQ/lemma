package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme

enum class LemmaButtonVariant {
    Primary,
    Secondary,
    Ghost
}

@Composable
fun LemmaButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: LemmaButtonVariant = LemmaButtonVariant.Primary,
    enabled: Boolean = true
) {
    val backgroundColor = when (variant) {
        LemmaButtonVariant.Primary -> if (enabled) LemmaTheme.colors.primary else LemmaTheme.colors.fill2
        LemmaButtonVariant.Secondary -> if (enabled) LemmaTheme.colors.fill2 else LemmaTheme.colors.fill1
        LemmaButtonVariant.Ghost -> Color.Transparent
    }

    val textColor = when (variant) {
        LemmaButtonVariant.Primary -> if (enabled) Color.White else LemmaTheme.colors.textQuaternary
        LemmaButtonVariant.Secondary -> if (enabled) LemmaTheme.colors.textPrimary else LemmaTheme.colors.textQuaternary
        LemmaButtonVariant.Ghost -> if (enabled) LemmaTheme.colors.primary else LemmaTheme.colors.textQuaternary
    }

    Box(
        modifier = modifier
            .clip(LemmaTheme.shapes.full)
            .background(backgroundColor)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = textColor,
            style = LemmaTheme.typography.bodyMedium
        )
    }
}
