package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme

@Composable
fun LemmaSettingsGroup(
    label: String,
    modifier: Modifier = Modifier,
    description: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = label,
            style = LemmaTheme.typography.titleMedium,
            color = LemmaTheme.colors.textPrimary,
        )
        if (description != null) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = description,
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.textSecondary,
            )
        }
        Spacer(modifier = Modifier.height(10.dp))
        Column(
            modifier =
                Modifier.fillMaxWidth()
                    .clip(LemmaTheme.shapes.medium)
                    .background(LemmaTheme.colors.fill2),
            content = content,
        )
    }
}
