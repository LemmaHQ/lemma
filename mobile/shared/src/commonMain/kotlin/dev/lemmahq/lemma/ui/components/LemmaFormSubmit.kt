package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme

/**
 * The end of a form: its [error] when the last submission failed, then the button labeled [text]
 * that calls [onSubmit], replaced by a spinner while [busy].
 */
@Composable
fun LemmaFormSubmit(
    error: String?,
    busy: Boolean,
    text: String,
    onSubmit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        error?.let {
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = it,
                style = LemmaTheme.typography.labelSmall,
                color = LemmaTheme.colors.danger,
                modifier = Modifier.align(Alignment.Start),
            )
        }
        Spacer(modifier = Modifier.height(20.dp))
        if (busy) {
            CircularProgressIndicator(
                color = LemmaTheme.colors.primary,
                modifier = Modifier.size(28.dp),
            )
        } else {
            LemmaButton(
                text = text,
                onClick = onSubmit,
                modifier = Modifier.fillMaxWidth(),
                variant = LemmaButtonVariant.Primary,
            )
        }
    }
}
