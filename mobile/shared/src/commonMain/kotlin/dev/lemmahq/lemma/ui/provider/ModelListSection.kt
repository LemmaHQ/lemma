package dev.lemmahq.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.components.LemmaButtonVariant
import dev.lemmahq.lemma.ui.components.LemmaIconButton
import dev.lemmahq.lemma.ui.components.LemmaTextField
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.common_cancel
import lemma.mobile.shared.generated.resources.icon_check
import lemma.mobile.shared.generated.resources.icon_plus
import lemma.mobile.shared.generated.resources.icon_refresh_cw
import lemma.mobile.shared.generated.resources.icon_search
import lemma.mobile.shared.generated.resources.icon_x
import lemma.mobile.shared.generated.resources.provider_add_model
import lemma.mobile.shared.generated.resources.provider_fetch_model_list
import lemma.mobile.shared.generated.resources.provider_model_list
import lemma.mobile.shared.generated.resources.provider_model_placeholder
import lemma.mobile.shared.generated.resources.provider_model_search_placeholder
import lemma.mobile.shared.generated.resources.provider_no_models
import lemma.mobile.shared.generated.resources.provider_remove_model
import org.jetbrains.compose.resources.stringResource

/** The model list of a provider with search, adding by name, removal, and fetching. */
@Composable
internal fun ModelListSection(
    models: List<String>,
    fetching: Boolean,
    onFetch: () -> Unit,
    onAdd: (String) -> Unit,
    onRemove: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var query by rememberSaveable { mutableStateOf("") }
    var adding by rememberSaveable { mutableStateOf(false) }
    var newModel by rememberSaveable { mutableStateOf("") }
    val visible = models.filter { it.contains(query.trim(), ignoreCase = true) }
    val closeAdding = {
        adding = false
        newModel = ""
    }

    Column(modifier = modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = stringResource(Res.string.provider_model_list),
                style = LemmaTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium),
                color = LemmaTheme.colors.textPrimary,
                modifier = Modifier.weight(1f),
            )
            LemmaButton(
                text = stringResource(Res.string.provider_fetch_model_list),
                onClick = onFetch,
                variant = LemmaButtonVariant.Secondary,
                enabled = !fetching,
                icon = Res.drawable.icon_refresh_cw,
            )
            Spacer(modifier = Modifier.width(4.dp))
            LemmaIconButton(
                icon = Res.drawable.icon_plus,
                contentDescription = stringResource(Res.string.provider_add_model),
                onClick = { adding = !adding },
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        LemmaTextField(
            value = query,
            onValueChange = { query = it },
            placeholder = stringResource(Res.string.provider_model_search_placeholder),
            leadingIcon = Res.drawable.icon_search,
        )
        if (adding) {
            Spacer(modifier = Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                LemmaTextField(
                    value = newModel,
                    onValueChange = { newModel = it },
                    placeholder = stringResource(Res.string.provider_model_placeholder),
                    modifier = Modifier.weight(1f),
                )
                LemmaIconButton(
                    icon = Res.drawable.icon_check,
                    contentDescription = stringResource(Res.string.provider_add_model),
                    onClick = {
                        onAdd(newModel)
                        closeAdding()
                    },
                )
                LemmaIconButton(
                    icon = Res.drawable.icon_x,
                    contentDescription = stringResource(Res.string.common_cancel),
                    onClick = closeAdding,
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        if (visible.isEmpty()) {
            Text(
                text = stringResource(Res.string.provider_no_models),
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.textTertiary,
                modifier = Modifier.padding(vertical = 8.dp),
            )
        } else {
            Column(
                modifier =
                    Modifier.fillMaxWidth()
                        .clip(LemmaTheme.shapes.medium)
                        .background(LemmaTheme.colors.fill2)
            ) {
                visible.forEachIndexed { index, model ->
                    if (index > 0) {
                        HorizontalDivider(
                            color = LemmaTheme.colors.separator,
                            modifier = Modifier.padding(start = 16.dp),
                        )
                    }
                    ModelRow(model = model, onRemove = { onRemove(model) })
                }
            }
        }
    }
}

@Composable
private fun ModelRow(model: String, onRemove: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).padding(start = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = model,
            style = LemmaTheme.typography.bodyMedium,
            color = LemmaTheme.colors.textPrimary,
            modifier = Modifier.weight(1f),
        )
        LemmaIconButton(
            icon = Res.drawable.icon_x,
            contentDescription = stringResource(Res.string.provider_remove_model),
            onClick = onRemove,
            tint = LemmaTheme.colors.textSecondary,
        )
    }
}
