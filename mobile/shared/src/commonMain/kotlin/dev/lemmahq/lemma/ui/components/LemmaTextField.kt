package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme

@Composable
fun LemmaTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    enabled: Boolean = true,
    singleLine: Boolean = true
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(LemmaTheme.shapes.medium)
            .background(LemmaTheme.colors.fill2)
            .padding(horizontal = 16.dp, vertical = 14.dp)
    ) {
        if (value.isEmpty()) {
            Text(
                text = placeholder,
                color = LemmaTheme.colors.textTertiary,
                style = LemmaTheme.typography.bodyLarge
            )
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            enabled = enabled,
            singleLine = singleLine,
            textStyle = LemmaTheme.typography.bodyLarge.copy(
                color = LemmaTheme.colors.textPrimary
            ),
            cursorBrush = SolidColor(LemmaTheme.colors.primary),
            modifier = Modifier.fillMaxWidth()
        )
    }
}
