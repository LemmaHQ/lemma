package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme

/** A form field: [label] and [description] above the control, [error] below it when set. */
@Composable
fun LemmaField(
    label: String,
    description: String,
    modifier: Modifier = Modifier,
    error: String? = null,
    content: @Composable () -> Unit,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = label,
            style = LemmaTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium),
            color = LemmaTheme.colors.textPrimary,
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = description,
            style = LemmaTheme.typography.bodyMedium,
            color = LemmaTheme.colors.textSecondary,
        )
        Spacer(modifier = Modifier.height(8.dp))
        content()
        if (error != null) {
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = error,
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.danger,
            )
        }
    }
}
