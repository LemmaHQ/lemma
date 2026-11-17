package dev.lemmahq.lemma.ui.agent

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
import lemma.mobile.shared.generated.resources.session_tree_add_label
import lemma.mobile.shared.generated.resources.session_tree_edit_label
import lemma.mobile.shared.generated.resources.session_tree_label_placeholder
import org.jetbrains.compose.resources.stringResource

/** The dialog editing a tree row's bookmark, starting from its [label]; saving empty clears it. */
@Composable
internal fun TreeLabelDialog(label: String?, onSave: (String) -> Unit, onDismiss: () -> Unit) {
    var value by rememberSaveable { mutableStateOf(label.orEmpty()) }
    LemmaDialog(
        title =
            stringResource(
                if (label == null) Res.string.session_tree_add_label
                else Res.string.session_tree_edit_label
            ),
        dismissLabel = stringResource(Res.string.common_cancel),
        confirmLabel = stringResource(Res.string.common_save),
        onConfirm = { onSave(value) },
        onDismiss = onDismiss,
    ) {
        Spacer(modifier = Modifier.height(16.dp))
        LemmaTextField(
            value = value,
            onValueChange = { value = it },
            placeholder = stringResource(Res.string.session_tree_label_placeholder),
        )
    }
}
