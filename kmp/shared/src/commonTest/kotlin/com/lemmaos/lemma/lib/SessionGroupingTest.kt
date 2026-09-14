package com.lemmaos.lemma.lib

import com.lemmaos.lemma.domain.Conversation
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toInstant
import kotlin.test.Test
import kotlin.test.assertEquals

class SessionGroupingTest {

    private val zone = TimeZone.UTC

    // Pin the clock to noon: the buckets are calendar days, so a wall-clock
    // run within minutes of midnight would spill "today" into "yesterday".
    private val now = LocalDateTime(2026, 5, 15, 12, 0, 0).toInstant(zone)

    private fun ms(daysAgo: Int, hour: Int = 10): Long {
        val base = LocalDateTime(2026, 5, 15, hour, 0, 0).toInstant(zone)
        return base.toEpochMilliseconds() - daysAgo * 24 * 60 * 60 * 1000L
    }

    private fun conversation(id: String, updatedAtMs: Long) = Conversation(
        id = id,
        title = id,
        archived = false,
        messageCount = 0,
        createdAtMs = updatedAtMs,
        updatedAtMs = updatedAtMs,
        archivedAtMs = null,
    )

    @Test
    fun groupsSessionsByCalendarDayOmittingEmptyBuckets() {
        val groups = groupSessions(
            listOf(
                conversation("a", now.toEpochMilliseconds() - 60_000),
                conversation("b", ms(1)),
                conversation("c", ms(3)),
                conversation("d", ms(30)),
            ),
            now.toEpochMilliseconds(),
            zone,
        )

        assertEquals(
            listOf(GroupKey.TODAY, GroupKey.YESTERDAY, GroupKey.LAST_7_DAYS, GroupKey.EARLIER),
            groups.map { it.key },
        )
        assertEquals(listOf("a"), groups.first { it.key == GroupKey.TODAY }.items.map { it.id })
    }

    @Test
    fun sortsSessionsDescendingByUpdatedAtMsWithinEachGroup() {
        val nowMs = now.toEpochMilliseconds()
        val groups = groupSessions(
            listOf(
                conversation("old", nowMs - 2 * 60_000),
                conversation("new", nowMs - 60_000),
            ),
            nowMs,
            zone,
        )

        assertEquals(
            listOf("new", "old"),
            groups.first { it.key == GroupKey.TODAY }.items.map { it.id },
        )
    }
}
