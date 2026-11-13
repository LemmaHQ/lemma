package dev.lemmahq.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaSwitch
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.provider_enable_provider
import org.jetbrains.compose.resources.stringResource

@Composable
internal fun ProviderEnabledRow(
    enabled: Boolean,
    onChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    interactionEnabled: Boolean = true,
    hint: String? = null,
    label: String? = null,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(LemmaTheme.shapes.medium)
                .background(LemmaTheme.colors.fill2)
    ) {
        Row(
            modifier =
                Modifier.fillMaxWidth()
                    .heightIn(min = 56.dp)
                    .toggleable(
                        value = enabled,
                        role = Role.Switch,
                        enabled = interactionEnabled,
                        onValueChange = onChange,
                    )
                    .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = label ?: stringResource(Res.string.provider_enable_provider),
                style = LemmaTheme.typography.bodyLarge,
                color = LemmaTheme.colors.textPrimary,
                modifier = Modifier.weight(1f),
            )
            LemmaSwitch(
                checked = enabled,
                onCheckedChange = null,
                enabled = interactionEnabled,
            )
        }
        hint?.let {
            Text(
                text = it,
                style = LemmaTheme.typography.labelSmall,
                color = LemmaTheme.colors.textTertiary,
                modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 12.dp),
            )
        }
    }
}
