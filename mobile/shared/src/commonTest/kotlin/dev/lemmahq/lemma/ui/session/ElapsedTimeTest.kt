package dev.lemmahq.lemma.ui.session

import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.ui.platform.InfiniteAnimationPolicy
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest

@OptIn(ExperimentalCoroutinesApi::class)
class ElapsedTimeTest {

    @Test
    fun durationsReadInTheLargestFittingUnit() {
        assertEquals(
            listOf("1ms", "999ms", "1.0s", "59.9s", "1m 00s", "2m 05s"),
            listOf(0L, 999, 1_000, 59_999, 60_000, 125_400).map { formatDuration(it) },
        )
    }

    @Test
    fun aGrowingDurationCountsTenthsOfASecondFromZero() {
        assertEquals(
            listOf("0.0s", "0.4s", "12.3s"),
            listOf(0L, 450, 12_340).map { formatDuration(it, live = true) },
        )
    }

    @Test
    fun theClockTicksEveryTenthOfASecondUntilCancelled() = runTest {
        val clock = mutableLongStateOf(0)
        val ticks = mutableListOf<Long>()

        val ticking = launch { tickClock(clock) }
        repeat(3) {
            runCurrent()
            ticks += clock.longValue
            clock.longValue = 0
            advanceTimeBy(100)
        }
        ticking.cancel()

        assertTrue(ticks.all { it > 0 })
    }

    @Test
    fun theClockTicksAsAnInfiniteOperationUnderTheAnimationPolicy() = runTest {
        var operations = 0
        val policy =
            object : InfiniteAnimationPolicy {
                override suspend fun <R> onInfiniteOperation(block: suspend () -> R): R {
                    operations++
                    return block()
                }
            }
        val clock = mutableLongStateOf(0)

        val ticking = launch(policy) { tickClock(clock) }
        runCurrent()
        ticking.cancel()

        assertEquals(1, operations)
        assertTrue(clock.longValue > 0)
    }
}
