package io.github.mistvesper.lemma.ui.agent

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.theme.LemmaTheme

/** A compact text button inside a composer section, filled when [primary]. */
@Composable
internal fun ComposerAction(text: String, primary: Boolean, onClick: () -> Unit) {
    Text(
        text = text,
        style = LemmaTheme.typography.small,
        color = if (primary) LemmaTheme.colors.primaryForeground else LemmaTheme.colors.foreground,
        maxLines = 1,
        modifier =
            Modifier.minimumInteractiveComponentSize()
                .clip(LemmaTheme.shapes.sm)
                .then(if (primary) Modifier.background(LemmaTheme.colors.primary) else Modifier)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = 8.dp, vertical = 4.dp),
    )
}
