package io.github.mistvesper.lemma.ui.agent

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.theme.LemmaTheme
import io.github.mistvesper.lemma.ui.components.LemmaInput
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.session_input_placeholder
import lemma.mobile.shared.generated.resources.session_select_model
import lemma.mobile.shared.generated.resources.session_send
import org.jetbrains.compose.resources.stringResource

/**
 * The composer box: the [header] sections that take over its top, the message field, and a footer
 * holding the [modelLabel] button, hidden when null, that opens the model picker, and the send
 * button, which waits while [turnRunning].
 */
@Composable
internal fun MessageComposer(
    value: String,
    onValueChange: (String) -> Unit,
    turnRunning: Boolean,
    onSend: () -> Unit,
    modelLabel: String?,
    onOpenModelPicker: () -> Unit,
    focusRequester: FocusRequester,
    header: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(LemmaTheme.colors.border))
        LemmaInput(
            value = value,
            onValueChange = onValueChange,
            placeholder = stringResource(Res.string.session_input_placeholder),
            sendDescription = stringResource(Res.string.session_send),
            canSend = value.isNotBlank() && !turnRunning,
            onSend = onSend,
            focusRequester = focusRequester,
            header = header,
            modifier = Modifier.padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 12.dp),
        ) {
            modelLabel?.let { ModelButton(label = it, onClick = onOpenModelPicker) }
        }
    }
}

@Composable
private fun ModelButton(label: String, onClick: () -> Unit) {
    Box(
        modifier =
            Modifier.minimumInteractiveComponentSize()
                .widthIn(max = 160.dp)
                .clip(LemmaTheme.shapes.sm)
                .background(LemmaTheme.colors.selected)
                .clickable(
                    role = Role.Button,
                    onClickLabel = stringResource(Res.string.session_select_model),
                    onClick = onClick,
                )
                .padding(horizontal = 8.dp, vertical = 2.dp)
    ) {
        Text(
            text = label,
            style = LemmaTheme.typography.caption,
            color = LemmaTheme.colors.mutedForeground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
