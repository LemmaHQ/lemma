package io.github.mistvesper.lemma.ui.agent

import kotlin.test.Test
import kotlin.test.assertEquals

class FormatDurationTest {

    @Test
    fun durationsReadInTheLargestFittingUnit() {
        assertEquals(
            listOf("1ms", "999ms", "1.0s", "59.9s", "1m 00s", "2m 05s"),
            listOf(0L, 999, 1_000, 59_999, 60_000, 125_400).map(::formatDuration),
        )
    }

    @Test
    fun liveDurationsTickInTenthsOfASecond() {
        assertEquals(
            listOf("0.0s", "0.4s", "12.3s", "2m 05s"),
            listOf(0L, 400, 12_300, 125_400).map { formatDuration(it, live = true) },
        )
    }
}
