package dev.lemmahq.lemma.ui.agent

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.data.ModelSelection
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaBottomSheet
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.components.LemmaButtonVariant
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_check
import lemma.mobile.shared.generated.resources.session_manage_providers
import lemma.mobile.shared.generated.resources.session_select_model
import org.jetbrains.compose.resources.painterResource
import org.jetbrains.compose.resources.stringResource

/**
 * A sheet of the enabled [providers]' models grouped by provider, with [selection] checked, and a
 * button that leads to the provider settings.
 */
@Composable
internal fun ModelPickerSheet(
    providers: List<ClientProvider>,
    selection: ModelSelection?,
    onSelect: (ModelSelection) -> Unit,
    onManageProviders: () -> Unit,
    onDismiss: () -> Unit,
) {
    LemmaBottomSheet(
        onDismiss = onDismiss,
        title = stringResource(Res.string.session_select_model),
    ) {
        LazyColumn(
            modifier = Modifier.weight(1f, fill = false),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            providers
                .filter { it.enabled }
                .forEach { provider ->
                    item(key = "header_${provider.id}") {
                        Text(
                            text = provider.source.name,
                            style = LemmaTheme.typography.caption,
                            color = LemmaTheme.colors.subtleForeground,
                            modifier = Modifier.padding(vertical = 4.dp),
                        )
                    }
                    items(provider.source.models, key = { "${provider.id}/${it.id}" }) { model ->
                        val option = ModelSelection(provider.id, model.id)
                        ModelRow(
                            name = model.id,
                            selected = option == selection,
                            onClick = { onSelect(option) },
                        )
                    }
                }
        }
        Spacer(modifier = Modifier.height(12.dp))
        LemmaButton(
            text = stringResource(Res.string.session_manage_providers),
            onClick = onManageProviders,
            modifier = Modifier.fillMaxWidth(),
            variant = LemmaButtonVariant.Secondary,
        )
    }
}

@Composable
private fun ModelRow(name: String, selected: Boolean, onClick: () -> Unit) {
    Row(
        modifier =
            Modifier.fillMaxWidth()
                .heightIn(min = 44.dp)
                .clip(LemmaTheme.shapes.md)
                .background(if (selected) LemmaTheme.colors.selected else Color.Transparent)
                .selectable(selected = selected, onClick = onClick, role = Role.RadioButton)
                .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = name,
            style = LemmaTheme.typography.body,
            color = LemmaTheme.colors.foreground,
            modifier = Modifier.weight(1f),
        )
        if (selected) {
            Icon(
                painter = painterResource(Res.drawable.icon_check),
                contentDescription = null,
                tint = LemmaTheme.colors.primary,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}
