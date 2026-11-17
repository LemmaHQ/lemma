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
            style = LemmaTheme.typography.title,
            color = LemmaTheme.colors.foreground,
        )
        if (description != null) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = description,
                style = LemmaTheme.typography.body,
                color = LemmaTheme.colors.mutedForeground,
            )
        }
        Spacer(modifier = Modifier.height(10.dp))
        Column(
            modifier =
                Modifier.fillMaxWidth()
                    .clip(LemmaTheme.shapes.lg)
                    .background(LemmaTheme.colors.selected),
            content = content,
        )
    }
}
