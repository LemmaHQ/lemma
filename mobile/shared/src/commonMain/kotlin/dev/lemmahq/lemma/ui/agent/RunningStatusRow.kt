package dev.lemmahq.lemma.ui.agent

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import kotlin.time.Clock
import kotlinx.coroutines.delay
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.agent_stop_short
import org.jetbrains.compose.resources.stringResource

private const val TICK_MILLIS = 100L

/**
 * The running turn's [step] with the time since [startedAt], in epoch milliseconds, ticking on the
 * frame clock, and an action that stops the turn; [warn] marks a stream that resumes after it
 * broke.
 */
@Composable
internal fun RunningStatusRow(step: String, startedAt: Long, warn: Boolean, onStop: () -> Unit) {
    val elapsed by
        produceState(0L, startedAt) {
            val before = Clock.System.now().toEpochMilliseconds() - startedAt
            val start = withFrameMillis { it }
            while (true) {
                value = (before + withFrameMillis { it } - start).coerceAtLeast(0)
                delay(TICK_MILLIS)
            }
        }
    ComposerSection {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier.size(6.dp)
                        .background(
                            if (warn) LemmaTheme.colors.warning else LemmaTheme.colors.brand,
                            CircleShape,
                        )
            )
            Text(
                text = step,
                style = LemmaTheme.typography.small,
                color = LemmaTheme.colors.foreground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = formatDuration(elapsed, live = true),
                style = LemmaTheme.typography.caption.copy(fontFeatureSettings = "tnum"),
                color = LemmaTheme.colors.subtleForeground,
            )
            ComposerAction(
                text = stringResource(Res.string.agent_stop_short),
                primary = false,
                onClick = onStop,
            )
        }
    }
}
