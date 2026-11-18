package io.github.mistvesper.lemma.ui.agent

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.theme.LemmaTheme

/**
 * A notice atop the composer, such as a failed turn or a rewind: its [message] in [color],
 * announced when it appears, above the [actions] that resolve it.
 */
@Composable
internal fun ComposerDock(
    message: String,
    color: Color,
    actions: @Composable RowScope.() -> Unit,
) {
    ComposerSection {
        Text(
            text = message,
            style = LemmaTheme.typography.small,
            color = color,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier =
                Modifier.fillMaxWidth()
                    .semantics { liveRegion = LiveRegionMode.Polite }
                    .padding(start = 14.dp, end = 14.dp, top = 8.dp),
        )
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.End),
            verticalAlignment = Alignment.CenterVertically,
            content = actions,
        )
    }
}
