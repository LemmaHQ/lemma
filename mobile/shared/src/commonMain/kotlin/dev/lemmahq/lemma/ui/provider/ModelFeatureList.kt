package dev.lemmahq.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.client.ClientModel
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaIconButton
import dev.lemmahq.lemma.ui.components.LemmaSwitch
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_x
import lemma.mobile.shared.generated.resources.provider_remove_model
import lemma.mobile.shared.generated.resources.provider_tool_calling
import org.jetbrains.compose.resources.stringResource

/** Models with their tool-calling state; read-only without the change and remove callbacks. */
@Composable
internal fun ModelFeatureList(
    models: List<ClientModel>,
    modifier: Modifier = Modifier,
    onToolCallingChange: ((String, Boolean) -> Unit)? = null,
    onRemove: ((String) -> Unit)? = null,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(LemmaTheme.shapes.lg)
                .background(LemmaTheme.colors.selected)
    ) {
        models.forEachIndexed { index, model ->
            if (index > 0) {
                HorizontalDivider(
                    color = LemmaTheme.colors.border,
                    modifier = Modifier.padding(start = 16.dp),
                )
            }
            Row(
                modifier =
                    Modifier.fillMaxWidth()
                        .heightIn(min = 56.dp)
                        .padding(start = 16.dp, end = if (onRemove == null) 16.dp else 0.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = model.id,
                    style = LemmaTheme.typography.body,
                    color = LemmaTheme.colors.foreground,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = stringResource(Res.string.provider_tool_calling),
                    style = LemmaTheme.typography.caption,
                    color = LemmaTheme.colors.mutedForeground,
                    modifier = Modifier.padding(end = 8.dp),
                )
                LemmaSwitch(
                    checked = model.toolCalling,
                    onCheckedChange =
                        onToolCallingChange?.let { change -> { change(model.id, it) } },
                    enabled = onToolCallingChange != null,
                )
                onRemove?.let { remove ->
                    LemmaIconButton(
                        icon = Res.drawable.icon_x,
                        contentDescription = stringResource(Res.string.provider_remove_model),
                        onClick = { remove(model.id) },
                        tint = LemmaTheme.colors.mutedForeground,
                    )
                }
            }
        }
    }
}
