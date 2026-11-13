package dev.lemmahq.lemma.ui.provider

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.i18n.UiText
import dev.lemmahq.lemma.theme.LemmaTheme

@Composable
internal fun ProviderErrorText(error: UiText?, modifier: Modifier = Modifier) {
    error?.let {
        Text(
            text = it.text(),
            style = LemmaTheme.typography.bodyMedium,
            color = LemmaTheme.colors.danger,
            modifier = modifier.padding(horizontal = 16.dp, vertical = 4.dp),
        )
    }
}
