package dev.lemmahq.lemma.ui.provider

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.components.LemmaButtonVariant
import dev.lemmahq.lemma.ui.components.LemmaField
import dev.lemmahq.lemma.ui.components.LemmaTextField
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.common_cancel
import lemma.mobile.shared.generated.resources.common_save
import lemma.mobile.shared.generated.resources.provider_identifier
import lemma.mobile.shared.generated.resources.provider_identifier_hint
import lemma.mobile.shared.generated.resources.provider_name
import lemma.mobile.shared.generated.resources.provider_name_description
import lemma.mobile.shared.generated.resources.provider_name_placeholder
import lemma.mobile.shared.generated.resources.provider_settings_title
import org.jetbrains.compose.resources.stringResource

/** The dialog showing a provider's fixed [identifier] and editing its [name]. */
@Composable
internal fun ProviderSettingsDialog(
    identifier: String,
    name: String,
    onNameChange: (String) -> Unit,
    error: String?,
    saveEnabled: Boolean,
    onSave: () -> Unit,
    onDismiss: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier =
                Modifier.clip(LemmaTheme.shapes.large)
                    .background(LemmaTheme.colors.backgroundGroup)
                    .padding(20.dp)
        ) {
            Text(
                text = stringResource(Res.string.provider_settings_title),
                style = LemmaTheme.typography.titleMedium,
                color = LemmaTheme.colors.textPrimary,
            )
            Spacer(modifier = Modifier.height(16.dp))
            LemmaField(
                label = stringResource(Res.string.provider_identifier),
                description = stringResource(Res.string.provider_identifier_hint),
            ) {
                LemmaTextField(value = identifier, onValueChange = {}, enabled = false)
            }
            Spacer(modifier = Modifier.height(16.dp))
            LemmaField(
                label = stringResource(Res.string.provider_name),
                description = stringResource(Res.string.provider_name_description),
                error = error,
            ) {
                LemmaTextField(
                    value = name,
                    onValueChange = onNameChange,
                    placeholder = stringResource(Res.string.provider_name_placeholder),
                )
            }
            Spacer(modifier = Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LemmaButton(
                    text = stringResource(Res.string.common_cancel),
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f),
                    variant = LemmaButtonVariant.Secondary,
                )
                LemmaButton(
                    text = stringResource(Res.string.common_save),
                    onClick = onSave,
                    modifier = Modifier.weight(1f),
                    enabled = saveEnabled,
                )
            }
        }
    }
}
