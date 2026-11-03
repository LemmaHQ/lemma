package dev.lemmahq.lemma.ui.session

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme

@Composable
internal fun SessionTopBar(
    title: String,
    modelLabel: String?,
    onOpenDrawer: () -> Unit,
    onOpenModelPicker: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.clickable(onClick = onOpenDrawer),
        ) {
            Text(
                text = "☰",
                style = LemmaTheme.typography.titleLarge,
                color = LemmaTheme.colors.textPrimary,
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = title,
                style = LemmaTheme.typography.titleMedium,
                color = LemmaTheme.colors.textPrimary,
                maxLines = 1,
            )
        }

        if (modelLabel != null) {
            Box(
                modifier =
                    Modifier.clip(LemmaTheme.shapes.full)
                        .background(LemmaTheme.colors.fill2)
                        .clickable(onClick = onOpenModelPicker)
                        .padding(horizontal = 10.dp, vertical = 4.dp)
            ) {
                Text(
                    text = modelLabel,
                    style = LemmaTheme.typography.labelSmall,
                    color = LemmaTheme.colors.textSecondary,
                )
            }
        }
    }
}
