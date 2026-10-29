package dev.lemmahq.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TriStateCheckbox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.components.LemmaButtonVariant
import dev.lemmahq.lemma.ui.components.LemmaTextField

/**
 * Dialog listing the upstream models of a fetch; models in [existing] show as added, and [onAdd]
 * receives the picked ones in upstream order.
 */
@Composable
internal fun FetchedModelsDialog(
    remote: List<String>,
    existing: List<String>,
    onAdd: (List<String>) -> Unit,
    onDismiss: () -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var picked by remember { mutableStateOf(emptySet<String>()) }
    val added = existing.toSet()
    val visible = remote.filter { it.contains(query.trim(), ignoreCase = true) }
    val pickable = visible.filterNot { it in added }
    val pickedVisible = pickable.count { it in picked }
    val allState =
        when (pickedVisible) {
            0 -> ToggleableState.Off
            pickable.size -> ToggleableState.On
            else -> ToggleableState.Indeterminate
        }
    val checkboxColors =
        CheckboxDefaults.colors(
            checkedColor = LemmaTheme.colors.primary,
            uncheckedColor = LemmaTheme.colors.textTertiary,
            checkmarkColor = LemmaTheme.colors.background,
            disabledCheckedColor = LemmaTheme.colors.fill3,
            disabledIndeterminateColor = LemmaTheme.colors.fill3,
        )

    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier =
                Modifier.clip(LemmaTheme.shapes.medium)
                    .background(LemmaTheme.colors.backgroundGroup)
                    .padding(20.dp)
        ) {
            Text(
                text = "Pick models",
                style = LemmaTheme.typography.titleMedium,
                color = LemmaTheme.colors.textPrimary,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text =
                    "The provider returned ${remote.size} " +
                        (if (remote.size == 1) "model" else "models") +
                        ". Pick the ones to add to the list.",
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.textSecondary,
            )
            Spacer(modifier = Modifier.height(12.dp))
            LemmaTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = "Search models…",
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                TriStateCheckbox(
                    state = allState,
                    onClick = {
                        picked =
                            if (allState == ToggleableState.On) picked - pickable.toSet()
                            else picked + pickable
                    },
                    enabled = pickable.isNotEmpty(),
                    colors = checkboxColors,
                )
                Text(
                    text = "Select all",
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.textSecondary,
                )
            }
            if (visible.isEmpty()) {
                Text(
                    text = "No models match the current filter.",
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.textTertiary,
                    modifier = Modifier.padding(vertical = 12.dp),
                )
            }
            LazyColumn(modifier = Modifier.weight(1f, fill = false)) {
                items(visible, key = { it }) { model ->
                    val isAdded = model in added
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier =
                            Modifier.fillMaxWidth().clip(LemmaTheme.shapes.medium).clickable(
                                enabled = !isAdded
                            ) {
                                picked = if (model in picked) picked - model else picked + model
                            },
                    ) {
                        Checkbox(
                            checked = isAdded || model in picked,
                            onCheckedChange = null,
                            enabled = !isAdded,
                            colors = checkboxColors,
                        )
                        Text(
                            text = model,
                            style = LemmaTheme.typography.bodyMedium,
                            color =
                                if (isAdded) LemmaTheme.colors.textTertiary
                                else LemmaTheme.colors.textPrimary,
                            modifier = Modifier.weight(1f),
                        )
                        if (isAdded) {
                            Text(
                                text = "Added",
                                style = LemmaTheme.typography.labelSmall,
                                color = LemmaTheme.colors.textTertiary,
                                modifier = Modifier.padding(end = 12.dp),
                            )
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LemmaButton(
                    text = "Cancel",
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f),
                    variant = LemmaButtonVariant.Secondary,
                )
                LemmaButton(
                    text = "Add ${picked.size} " + if (picked.size == 1) "model" else "models",
                    onClick = { onAdd(remote.filter { it in picked }) },
                    modifier = Modifier.weight(1f),
                    variant = LemmaButtonVariant.Primary,
                    enabled = picked.isNotEmpty(),
                )
            }
        }
    }
}
