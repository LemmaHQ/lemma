package io.github.mistvesper.lemma.ui.components

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.i18n.UiText
import io.github.mistvesper.lemma.theme.LemmaTheme

@Composable
internal fun ProviderErrorText(error: UiText?, modifier: Modifier = Modifier) {
    error?.let {
        Text(
            text = it.text(),
            style = LemmaTheme.typography.body,
            color = LemmaTheme.colors.destructive,
            modifier = modifier.padding(horizontal = 16.dp, vertical = 4.dp),
        )
    }
}
