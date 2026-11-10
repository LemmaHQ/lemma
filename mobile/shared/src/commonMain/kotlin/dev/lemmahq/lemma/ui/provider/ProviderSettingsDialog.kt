package dev.lemmahq.lemma.ui.provider

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.ui.components.LemmaDialog
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
    LemmaDialog(
        title = stringResource(Res.string.provider_settings_title),
        dismissLabel = stringResource(Res.string.common_cancel),
        confirmLabel = stringResource(Res.string.common_save),
        onConfirm = onSave,
        onDismiss = onDismiss,
        confirmEnabled = saveEnabled,
    ) {
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
    }
}
