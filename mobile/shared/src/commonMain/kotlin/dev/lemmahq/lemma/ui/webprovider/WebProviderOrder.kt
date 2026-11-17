package dev.lemmahq.lemma.ui.webprovider

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.client.ClientWebProvider
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaIconButton
import dev.lemmahq.lemma.ui.components.LemmaSettingsGroup
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_arrow_down
import lemma.mobile.shared.generated.resources.icon_arrow_up
import lemma.mobile.shared.generated.resources.provider_web_move_down
import lemma.mobile.shared.generated.resources.provider_web_move_up
import org.jetbrains.compose.resources.stringResource

@Composable
internal fun WebProviderOrder(
    title: String,
    description: String,
    providers: List<ClientWebProvider>,
    onMove: (id: String, direction: Int) -> Unit,
) {
    LemmaSettingsGroup(label = title, description = description) {
        providers.forEachIndexed { index, provider ->
            if (index > 0) HorizontalDivider(color = LemmaTheme.colors.border)
            Row(
                modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(start = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = provider.name,
                    style = LemmaTheme.typography.body,
                    color = LemmaTheme.colors.foreground,
                    modifier = Modifier.weight(1f),
                )
                LemmaIconButton(
                    icon = Res.drawable.icon_arrow_up,
                    contentDescription =
                        stringResource(Res.string.provider_web_move_up, provider.name),
                    onClick = { onMove(provider.id, -1) },
                    enabled = index > 0,
                    tint = LemmaTheme.colors.mutedForeground,
                )
                LemmaIconButton(
                    icon = Res.drawable.icon_arrow_down,
                    contentDescription =
                        stringResource(Res.string.provider_web_move_down, provider.name),
                    onClick = { onMove(provider.id, 1) },
                    enabled = index < providers.lastIndex,
                    tint = LemmaTheme.colors.mutedForeground,
                )
            }
        }
    }
}
