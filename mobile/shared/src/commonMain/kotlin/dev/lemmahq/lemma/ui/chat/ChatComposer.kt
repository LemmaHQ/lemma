package dev.lemmahq.lemma.ui.chat

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.ui.components.LemmaInput

@Composable
internal fun ChatComposer(
    value: String,
    onValueChange: (String) -> Unit,
    isStreaming: Boolean,
    stopDescription: String,
    onStop: () -> Unit,
    onSend: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
        LemmaInput(
            value = value,
            onValueChange = onValueChange,
            isStreaming = isStreaming,
            stopDescription = stopDescription,
            onStop = onStop,
            onSend = onSend,
        )
    }
}
