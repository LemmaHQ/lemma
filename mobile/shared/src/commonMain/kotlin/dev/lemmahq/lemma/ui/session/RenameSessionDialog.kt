package dev.lemmahq.lemma.ui.session

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.components.LemmaButtonVariant
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
    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier =
                Modifier.clip(LemmaTheme.shapes.large)
                    .background(LemmaTheme.colors.backgroundGroup)
                    .padding(20.dp)
        ) {
            Text(
                text = stringResource(Res.string.session_rename),
                style = LemmaTheme.typography.titleMedium,
                color = LemmaTheme.colors.textPrimary,
            )
            Spacer(modifier = Modifier.height(16.dp))
            LemmaTextField(
                value = value,
                onValueChange = { value = it },
                placeholder = stringResource(Res.string.session_untitled),
            )
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
                    onClick = { onSave(value) },
                    modifier = Modifier.weight(1f),
                    enabled = value.isNotBlank(),
                )
            }
        }
    }
}
