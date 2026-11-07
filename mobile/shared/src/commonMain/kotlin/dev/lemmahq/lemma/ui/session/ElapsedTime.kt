package dev.lemmahq.lemma.ui.session

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableLongState
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.InfiniteAnimationPolicy
import kotlin.coroutines.coroutineContext
import kotlin.time.Clock
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds
import kotlinx.coroutines.delay

private const val TICK_MILLIS = 100L
private const val NANOS_PER_TENTH = 100_000_000

/**
 * Formats [millis] as 350ms, 12.3s, or 2m 05s; a [live] duration, which is still growing, starts at
 * 0.0s instead of counting milliseconds.
 */
internal fun formatDuration(millis: Long, live: Boolean = false): String {
    val duration = millis.milliseconds
    return when {
        !live && duration < 1.seconds -> "${millis.coerceAtLeast(1)}ms"
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

/**
 * The milliseconds from [startedAt] to [finishedAt], or to now while [finishedAt] is null, ticking
 * every tenth of a second as an infinite animation; null without [startedAt]. Instants are epoch
 * milliseconds.
 */
@Composable
internal fun rememberElapsed(startedAt: Long?, finishedAt: Long?): Long? {
    val now = remember { mutableLongStateOf(currentMillis()) }
    LaunchedEffect(startedAt, finishedAt) {
        if (startedAt != null && finishedAt == null) tickClock(now)
    }
    startedAt ?: return null
    return ((finishedAt ?: now.longValue) - startedAt).coerceAtLeast(0)
}

/**
 * Sets [clock] to the current epoch millisecond every tenth of a second, as an infinite operation
 * of the context's [InfiniteAnimationPolicy] when it has one.
 */
internal suspend fun tickClock(clock: MutableLongState) {
    val policy = coroutineContext[InfiniteAnimationPolicy]
    if (policy == null) tick(clock) else policy.onInfiniteOperation { tick(clock) }
}

private suspend fun tick(clock: MutableLongState): Nothing {
    while (true) {
        clock.longValue = currentMillis()
        delay(TICK_MILLIS)
    }
}

private fun currentMillis() = Clock.System.now().toEpochMilliseconds()
