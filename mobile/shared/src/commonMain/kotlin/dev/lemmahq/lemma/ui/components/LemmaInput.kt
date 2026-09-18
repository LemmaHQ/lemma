package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme

@Composable
fun LemmaInput(
    value: String,
    onValueChange: (String) -> Unit,
    onSend: () -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Type a message..."
) {
    val canSend = value.isNotBlank()

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(LemmaTheme.shapes.full)
            .background(LemmaTheme.colors.fill2)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .weight(1f)
                .padding(vertical = 4.dp)
        ) {
            if (value.isEmpty()) {
                Text(
                    text = placeholder,
                    color = LemmaTheme.colors.textTertiary,
                    style = LemmaTheme.typography.bodyMedium
                )
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle = LemmaTheme.typography.bodyMedium.copy(
                    color = LemmaTheme.colors.textPrimary
                ),
                cursorBrush = SolidColor(LemmaTheme.colors.primary),
                modifier = Modifier.fillMaxWidth()
            )
        }

        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(LemmaTheme.shapes.full)
                .background(if (canSend) LemmaTheme.colors.primary else LemmaTheme.colors.fill3)
                .clickable(enabled = canSend, onClick = onSend),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "↑",
                color = if (canSend) LemmaTheme.colors.userBubbleText else LemmaTheme.colors.textQuaternary,
                style = LemmaTheme.typography.bodyMedium
            )
        }
    }
}
