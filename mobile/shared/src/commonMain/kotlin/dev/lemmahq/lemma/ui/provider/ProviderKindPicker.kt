package dev.lemmahq.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme

internal val PROVIDER_KINDS = listOf("openai", "anthropic", "gemini")

/** Chips choosing a provider kind; [enabled] is false once the provider exists. */
@Composable
internal fun ProviderKindPicker(kind: String, enabled: Boolean, onSelect: (String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        PROVIDER_KINDS.forEach { option ->
            val selected = option == kind
            Box(
                modifier =
                    Modifier.clip(LemmaTheme.shapes.full)
                        .background(
                            if (selected) LemmaTheme.colors.primary else LemmaTheme.colors.fill2
                        )
                        .clickable(enabled = enabled) { onSelect(option) }
                        .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text(
                    text = option,
                    style = LemmaTheme.typography.labelSmall,
                    color =
                        if (selected) {
                            LemmaTheme.colors.background
                        } else {
                            LemmaTheme.colors.textSecondary
                        },
                )
            }
        }
    }
}
