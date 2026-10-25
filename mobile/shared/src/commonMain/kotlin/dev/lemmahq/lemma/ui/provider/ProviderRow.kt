package dev.lemmahq.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.theme.LemmaTheme

@Composable
internal fun ProviderRow(
    provider: ClientProvider,
    onToggleEnabled: (Boolean) -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier =
            Modifier.fillMaxWidth()
                .clip(LemmaTheme.shapes.medium)
                .background(LemmaTheme.colors.fill1)
                .padding(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = provider.name,
                    style = LemmaTheme.typography.bodyLarge,
                    color = LemmaTheme.colors.textPrimary,
                )
                Spacer(modifier = Modifier.width(8.dp))
                Box(
                    modifier =
                        Modifier.clip(LemmaTheme.shapes.full)
                            .background(LemmaTheme.colors.fill2)
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = provider.kind,
                        style = LemmaTheme.typography.labelSmall,
                        color = LemmaTheme.colors.textSecondary,
                    )
                }
            }
            Text(
                text = "${provider.identifier} · ${provider.baseUrl}",
                style = LemmaTheme.typography.labelSmall,
                color = LemmaTheme.colors.textTertiary,
                maxLines = 1,
            )
            Text(
                text = "${provider.models.size} models",
                style = LemmaTheme.typography.labelSmall,
                color = LemmaTheme.colors.textTertiary,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(
                    text = "Edit",
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.primary,
                    modifier = Modifier.clickable(onClick = onEdit),
                )
                Text(
                    text = "Delete",
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.danger,
                    modifier = Modifier.clickable(onClick = onDelete),
                )
            }
        }
        Switch(
            checked = provider.enabled,
            onCheckedChange = onToggleEnabled,
            colors = SwitchDefaults.colors(checkedTrackColor = LemmaTheme.colors.primary),
        )
    }
}
