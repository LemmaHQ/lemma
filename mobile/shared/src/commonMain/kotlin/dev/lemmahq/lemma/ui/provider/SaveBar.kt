package dev.lemmahq.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.components.LemmaButtonVariant
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.common_cancel
import lemma.mobile.shared.generated.resources.common_save
import lemma.mobile.shared.generated.resources.common_saving
import org.jetbrains.compose.resources.stringResource

/** The bar under a form with pending changes: [message] beside its cancel and save actions. */
@Composable
internal fun SaveBar(
    message: String,
    busy: Boolean,
    saveEnabled: Boolean,
    onSave: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth().background(LemmaTheme.colors.backgroundGroup)) {
        HorizontalDivider(color = LemmaTheme.colors.separator)
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = message,
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.textSecondary,
                modifier = Modifier.weight(1f),
            )
            LemmaButton(
                text = stringResource(Res.string.common_cancel),
                onClick = onCancel,
                variant = LemmaButtonVariant.Secondary,
                enabled = !busy,
            )
            LemmaButton(
                text =
                    stringResource(if (busy) Res.string.common_saving else Res.string.common_save),
                onClick = onSave,
                enabled = !busy && saveEnabled,
            )
        }
    }
}
