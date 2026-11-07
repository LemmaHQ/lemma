package dev.lemmahq.lemma.ui.session

import dev.lemmahq.lemma.client.sampleSession
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toInstant

class SessionGroupsTest {

    private val shanghai = TimeZone.of("Asia/Shanghai")
    private val today = LocalDate(2026, 11, 6)

    private fun at(day: Int, hour: Int, minute: Int = 0): Long =
        LocalDateTime(2026, 11, day, hour, minute).toInstant(shanghai).toEpochMilliseconds()

    @Test
    fun sessionsGroupByLocalDayNewestFirst() {
        val sessions =
            listOf(
                sampleSession("earlier", updatedAt = at(day = 6, hour = 12).minusDays(30)),
                sampleSession("today-morning", updatedAt = at(day = 6, hour = 0)),
                sampleSession("yesterday-night", updatedAt = at(day = 5, hour = 23, minute = 59)),
                sampleSession("today-noon", updatedAt = at(day = 6, hour = 12)),
                sampleSession("six-days", updatedAt = at(day = 6, hour = 23).minusDays(6)),
                sampleSession("seven-days", updatedAt = at(day = 6, hour = 8).minusDays(7)),
            )

        val groups = groupSessions(sessions, today, shanghai)

        assertEquals(
            listOf(
                SessionPeriod.Today to listOf("today-noon", "today-morning"),
                SessionPeriod.Yesterday to listOf("yesterday-night"),
                SessionPeriod.Last7Days to listOf("six-days"),
                SessionPeriod.Earlier to listOf("seven-days", "earlier"),
            ),
            groups.map { group -> group.period to group.sessions.map { it.id } },
        )
    }

    @Test
    fun aSessionUpdatedAfterTodayCountsAsToday() {
        val groups =
            groupSessions(
                listOf(sampleSession("clock-skew", updatedAt = at(7, 9))),
                today,
                shanghai,
            )

        assertEquals(listOf(SessionPeriod.Today), groups.map { it.period })
    }
}

private fun Long.minusDays(days: Int): Long = this - days * 24L * 60 * 60 * 1000
