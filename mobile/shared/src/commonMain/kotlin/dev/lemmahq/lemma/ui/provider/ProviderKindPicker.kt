package dev.lemmahq.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme

/** Chips choosing one of [PROVIDER_KINDS]. */
@Composable
internal fun ProviderKindPicker(kind: String, onSelect: (String) -> Unit) {
    Row(
        modifier = Modifier.selectableGroup(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        PROVIDER_KINDS.forEach { option ->
            val selected = option == kind
            Box(
                modifier =
                    Modifier.heightIn(min = 40.dp)
                        .clip(LemmaTheme.shapes.full)
                        .background(
                            if (selected) LemmaTheme.colors.primary else LemmaTheme.colors.fill2
                        )
                        .selectable(
                            selected = selected,
                            role = Role.RadioButton,
                            onClick = { onSelect(option) },
                        )
                        .padding(horizontal = 16.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = option,
                    style = LemmaTheme.typography.bodyMedium,
                    color = if (selected) Color.White else LemmaTheme.colors.textSecondary,
                )
            }
        }
    }
}
