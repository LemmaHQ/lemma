package dev.lemmahq.lemma.ui.session

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.ui.components.LemmaDialog
import dev.lemmahq.lemma.ui.components.LemmaTextField
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.common_cancel
import lemma.mobile.shared.generated.resources.common_save
import lemma.mobile.shared.generated.resources.session_rename
import lemma.mobile.shared.generated.resources.session_untitled
import org.jetbrains.compose.resources.stringResource

/** The dialog editing a session title, starting from [title]. */
@Composable
internal fun RenameSessionDialog(
    title: String,
    onSave: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var value by rememberSaveable { mutableStateOf(title) }
    LemmaDialog(
        title = stringResource(Res.string.session_rename),
        dismissLabel = stringResource(Res.string.common_cancel),
        confirmLabel = stringResource(Res.string.common_save),
        onConfirm = { onSave(value) },
        onDismiss = onDismiss,
        confirmEnabled = value.isNotBlank(),
    ) {
        Spacer(modifier = Modifier.height(16.dp))
        LemmaTextField(
            value = value,
            onValueChange = { value = it },
            placeholder = stringResource(Res.string.session_untitled),
        )
    }
}
