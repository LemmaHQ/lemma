package dev.lemmahq.lemma.ui.provider

import androidx.compose.runtime.Composable
import dev.lemmahq.lemma.ui.components.LemmaConfirmDialog
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.provider_discard
import lemma.mobile.shared.generated.resources.provider_discard_desc
import lemma.mobile.shared.generated.resources.provider_discard_title
import lemma.mobile.shared.generated.resources.provider_keep_editing
import org.jetbrains.compose.resources.stringResource

@Composable
internal fun ProviderDiscardDialog(
    open: Boolean,
    onDiscard: () -> Unit,
    onDismiss: () -> Unit,
) {
    if (!open) return
    LemmaConfirmDialog(
        title = stringResource(Res.string.provider_discard_title),
        description = stringResource(Res.string.provider_discard_desc),
        confirmLabel = stringResource(Res.string.provider_discard),
        dismissLabel = stringResource(Res.string.provider_keep_editing),
        destructive = true,
        onConfirm = onDiscard,
        onDismiss = onDismiss,
    )
}
