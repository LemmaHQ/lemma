package dev.lemmahq.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.components.LemmaButtonVariant
import dev.lemmahq.lemma.ui.components.LemmaDropdownMenu
import dev.lemmahq.lemma.ui.components.LemmaDropdownMenuItem
import dev.lemmahq.lemma.ui.components.LemmaField
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_check
import lemma.mobile.shared.generated.resources.icon_chevron_down
import lemma.mobile.shared.generated.resources.icon_x
import lemma.mobile.shared.generated.resources.provider_check
import lemma.mobile.shared.generated.resources.provider_check_action
import lemma.mobile.shared.generated.resources.provider_check_description
import lemma.mobile.shared.generated.resources.provider_check_no_models
import lemma.mobile.shared.generated.resources.provider_check_passed
import org.jetbrains.compose.resources.painterResource
import org.jetbrains.compose.resources.stringResource

/**
 * The connectivity check: a choice among [models] and the check action, which [enabled] gates
 * besides an empty model list and a running check.
 */
@Composable
internal fun ConnectionCheckField(
    models: List<String>,
    model: String?,
    result: CheckResult?,
    enabled: Boolean,
    onPickModel: (String) -> Unit,
    onCheck: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var picking by remember { mutableStateOf(false) }
    LemmaField(
        label = stringResource(Res.string.provider_check),
        description =
            stringResource(
                if (result == CheckResult.Passed) Res.string.provider_check_passed
                else Res.string.provider_check_description
            ),
        error = (result as? CheckResult.Failed)?.message?.text(),
        modifier = modifier,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(modifier = Modifier.weight(1f)) {
                Row(
                    modifier =
                        Modifier.fillMaxWidth()
                            .heightIn(min = 52.dp)
                            .clip(LemmaTheme.shapes.medium)
                            .background(LemmaTheme.colors.fill2)
                            .clickable(enabled = models.isNotEmpty(), role = Role.DropdownList) {
                                picking = true
                            }
                            .padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = model ?: stringResource(Res.string.provider_check_no_models),
                        style = LemmaTheme.typography.bodyLarge,
                        color =
                            if (model == null) LemmaTheme.colors.textTertiary
                            else LemmaTheme.colors.textPrimary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    Icon(
                        painter = painterResource(Res.drawable.icon_chevron_down),
                        contentDescription = null,
                        tint = LemmaTheme.colors.textSecondary,
                        modifier = Modifier.size(18.dp),
                    )
                }
                LemmaDropdownMenu(expanded = picking, onDismiss = { picking = false }) {
                    models.forEach { option ->
                        LemmaDropdownMenuItem(
                            title = option,
                            onClick = {
                                picking = false
                                onPickModel(option)
                            },
                        )
                    }
                }
            }
            LemmaButton(
                text = stringResource(Res.string.provider_check_action),
                onClick = onCheck,
                variant = LemmaButtonVariant.Secondary,
                enabled = enabled && model != null && result != CheckResult.Checking,
                icon =
                    when (result) {
                        CheckResult.Passed -> Res.drawable.icon_check
                        is CheckResult.Failed -> Res.drawable.icon_x
                        else -> null
                    },
            )
        }
    }
}
