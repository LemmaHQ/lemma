package dev.lemmahq.lemma.ui.agent

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.components.LemmaButtonVariant

@Composable
internal fun ModelPickerDialog(
    providers: List<ClientProvider>,
    selectedProviderId: String,
    selectedModel: String,
    onSelect: (providerId: String, model: String) -> Unit,
    onManageProviders: () -> Unit,
    onDismiss: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier =
                Modifier.clip(LemmaTheme.shapes.medium)
                    .background(LemmaTheme.colors.backgroundGroup)
                    .padding(20.dp)
        ) {
            Text(
                text = "Select Model",
                style = LemmaTheme.typography.titleMedium,
                color = LemmaTheme.colors.textPrimary,
            )
            Spacer(modifier = Modifier.height(12.dp))
            LazyColumn(
                modifier = Modifier.weight(1f, fill = false),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                providers
                    .filter { it.enabled }
                    .forEach { provider ->
                        item(key = "header_${provider.id}") {
                            Text(
                                text = provider.name,
                                style = LemmaTheme.typography.labelSmall,
                                color = LemmaTheme.colors.textTertiary,
                                modifier = Modifier.padding(vertical = 4.dp),
                            )
                        }
                        items(provider.models, key = { "${provider.id}/$it" }) { model ->
                            val isSelected =
                                provider.id == selectedProviderId && model == selectedModel
                            Box(
                                modifier =
                                    Modifier.fillMaxWidth()
                                        .clip(LemmaTheme.shapes.medium)
                                        .background(
                                            if (isSelected) LemmaTheme.colors.fill2
                                            else LemmaTheme.colors.fill1
                                        )
                                        .clickable { onSelect(provider.id, model) }
                                        .padding(horizontal = 12.dp, vertical = 8.dp)
                            ) {
                                Text(
                                    text = model,
                                    style = LemmaTheme.typography.bodyMedium,
                                    color = LemmaTheme.colors.textPrimary,
                                )
                            }
                        }
                    }
            }
            Spacer(modifier = Modifier.height(12.dp))
            LemmaButton(
                text = "Manage Providers",
                onClick = onManageProviders,
                modifier = Modifier.fillMaxWidth(),
                variant = LemmaButtonVariant.Secondary,
            )
        }
    }
}
