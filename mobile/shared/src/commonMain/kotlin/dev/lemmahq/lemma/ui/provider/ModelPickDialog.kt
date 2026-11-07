package dev.lemmahq.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.selection.triStateToggleable
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TriStateCheckbox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.components.LemmaTextField
import dev.lemmahq.lemma.ui.components.LemmaTopBar
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_search
import lemma.mobile.shared.generated.resources.provider_add_picked
import lemma.mobile.shared.generated.resources.provider_model_added
import lemma.mobile.shared.generated.resources.provider_model_search_placeholder
import lemma.mobile.shared.generated.resources.provider_no_models
import lemma.mobile.shared.generated.resources.provider_pick_models_description
import lemma.mobile.shared.generated.resources.provider_pick_models_title
import lemma.mobile.shared.generated.resources.provider_select_all
import org.jetbrains.compose.resources.pluralStringResource
import org.jetbrains.compose.resources.stringResource

/**
 * A full-screen page picking among the [remote] models a fetch returned; models in [existing] show
 * as added, and [onAdd] receives the picked ones in their fetched order.
 */
@Composable
internal fun ModelPickDialog(
    remote: List<String>,
    existing: List<String>,
    onAdd: (List<String>) -> Unit,
    onDismiss: () -> Unit,
) {
    var query by rememberSaveable { mutableStateOf("") }
    var picked by rememberSaveable { mutableStateOf(emptyList<String>()) }
    val visible = remote.filter { it.contains(query.trim(), ignoreCase = true) }
    val pickable = visible.filterNot { it in existing }
    val allState =
        when (pickable.count { it in picked }) {
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

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Column(modifier = Modifier.fillMaxSize().background(LemmaTheme.colors.background)) {
            LemmaTopBar(
                title = stringResource(Res.string.provider_pick_models_title),
                onBack = onDismiss,
            )
            Column(modifier = Modifier.weight(1f).padding(horizontal = 16.dp)) {
                Text(
                    text =
                        pluralStringResource(
                            Res.plurals.provider_pick_models_description,
                            remote.size,
                            remote.size,
                        ),
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.textSecondary,
                )
                Spacer(modifier = Modifier.height(12.dp))
                LemmaTextField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = stringResource(Res.string.provider_model_search_placeholder),
                    leadingIcon = Res.drawable.icon_search,
                )
                Row(
                    modifier =
                        Modifier.fillMaxWidth()
                            .heightIn(min = 48.dp)
                            .triStateToggleable(
                                state = allState,
                                enabled = pickable.isNotEmpty(),
                                role = Role.Checkbox,
                                onClick = {
                                    picked =
                                        if (allState == ToggleableState.On) picked - pickable
                                        else (picked + pickable).distinct()
                                },
                            ),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TriStateCheckbox(
                        state = allState,
                        onClick = null,
                        enabled = pickable.isNotEmpty(),
                        colors = checkboxColors,
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = stringResource(Res.string.provider_select_all),
                        style = LemmaTheme.typography.bodyMedium,
                        color = LemmaTheme.colors.textSecondary,
                    )
                }
                if (visible.isEmpty()) {
                    Text(
                        text = stringResource(Res.string.provider_no_models),
                        style = LemmaTheme.typography.bodyMedium,
                        color = LemmaTheme.colors.textTertiary,
                        modifier = Modifier.padding(vertical = 12.dp),
                    )
                }
                LazyColumn(modifier = Modifier.weight(1f)) {
                    items(visible, key = { it }) { model ->
                        val added = model in existing
                        Row(
                            modifier =
                                Modifier.fillMaxWidth()
                                    .heightIn(min = 48.dp)
                                    .toggleable(
                                        value = added || model in picked,
                                        enabled = !added,
                                        role = Role.Checkbox,
                                        onValueChange = { checked ->
                                            picked = if (checked) picked + model else picked - model
                                        },
                                    ),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Checkbox(
                                checked = added || model in picked,
                                onCheckedChange = null,
                                enabled = !added,
                                colors = checkboxColors,
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = model,
                                style = LemmaTheme.typography.bodyMedium,
                                color =
                                    if (added) LemmaTheme.colors.textTertiary
                                    else LemmaTheme.colors.textPrimary,
                                modifier = Modifier.weight(1f),
                            )
                            if (added) {
                                Text(
                                    text = stringResource(Res.string.provider_model_added),
                                    style = LemmaTheme.typography.labelSmall,
                                    color = LemmaTheme.colors.textTertiary,
                                    modifier = Modifier.padding(end = 8.dp),
                                )
                            }
                        }
                    }
                }
            }
            HorizontalDivider(color = LemmaTheme.colors.separator)
            LemmaButton(
                text =
                    pluralStringResource(Res.plurals.provider_add_picked, picked.size, picked.size),
                onClick = { onAdd(remote.filter { it in picked }) },
                enabled = picked.isNotEmpty(),
                modifier = Modifier.fillMaxWidth().padding(16.dp),
            )
        }
    }
}
