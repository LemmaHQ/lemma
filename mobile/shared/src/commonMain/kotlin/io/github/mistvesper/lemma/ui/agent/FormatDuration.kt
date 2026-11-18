package io.github.mistvesper.lemma.ui.agent

import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

private const val NANOS_PER_TENTH = 100_000_000

/** Formats [millis] as 350ms, 12.3s, or 2m 05s; [live] time ticking up shows 0.4s instead of ms. */
internal fun formatDuration(millis: Long, live: Boolean = false): String {
    val duration = millis.milliseconds
    return when {
        duration < 1.seconds && !live -> "${millis.coerceAtLeast(1)}ms"
        duration < 1.minutes ->
            duration.toComponents { seconds, nanoseconds ->
                "$seconds.${nanoseconds / NANOS_PER_TENTH}s"
            }
        else ->
            duration.toComponents { minutes, seconds, _ ->
                "${minutes}m ${seconds.toString().padStart(2, '0')}s"
            }
    }
}
