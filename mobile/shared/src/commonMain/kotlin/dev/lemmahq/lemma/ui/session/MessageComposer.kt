package dev.lemmahq.lemma.ui.session

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.ui.components.LemmaInput
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.agent_stop
import lemma.mobile.shared.generated.resources.session_input_placeholder
import lemma.mobile.shared.generated.resources.session_send
import org.jetbrains.compose.resources.stringResource

@Composable
internal fun MessageComposer(
    value: String,
    onValueChange: (String) -> Unit,
    isStreaming: Boolean,
    onStop: () -> Unit,
    onSend: () -> Unit,
    focusRequester: FocusRequester,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
        LemmaInput(
            value = value,
            onValueChange = onValueChange,
            placeholder = stringResource(Res.string.session_input_placeholder),
            sendDescription = stringResource(Res.string.session_send),
            onSend = onSend,
            isStreaming = isStreaming,
            stopDescription = stringResource(Res.string.agent_stop),
            onStop = onStop,
            focusRequester = focusRequester,
        )
    }
}
