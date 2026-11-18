package io.github.mistvesper.lemma.ui.agent

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.theme.LemmaTheme

/** A section that takes over the top of the composer box, above a border line. */
@Composable
internal fun ComposerSection(content: @Composable () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().background(LemmaTheme.colors.sidebar)) {
        content()
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(LemmaTheme.colors.border))
    }
}
