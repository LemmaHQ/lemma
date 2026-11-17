package dev.lemmahq.lemma.ui.session

import dev.lemmahq.lemma.client.ClientSession
import kotlin.time.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.daysUntil
import kotlinx.datetime.format
import kotlinx.datetime.format.char
import kotlinx.datetime.toLocalDateTime

private val clockFormat = LocalDateTime.Format {
    hour()
    char(':')
    minute()
}
private val monthDayFormat = LocalDateTime.Format {
    monthNumber()
    char('-')
    day()
}
private val dateFormat = LocalDateTime.Format {
    year()
    char('-')
    monthNumber()
    char('-')
    day()
}

/** How long ago a session was last updated, by calendar day. */
internal enum class SessionPeriod {
    Today,
    Yesterday,
    Last7Days,
    Earlier,
}

internal data class SessionGroup(val period: SessionPeriod, val sessions: List<ClientSession>)

/**
 * [sessions] grouped by the day in [timeZone] of their last update relative to [today], most
 * recently updated first; empty groups are left out.
 */
internal fun groupSessions(
    sessions: List<ClientSession>,
    today: LocalDate,
    timeZone: TimeZone,
): List<SessionGroup> {
    val byPeriod =
        sessions
            .sortedByDescending { it.updatedAt }
            .groupBy { session ->
                val day = Instant.fromEpochMilliseconds(session.updatedAt).toLocalDateTime(timeZone)
                val days = day.date.daysUntil(today)
                when {
                    days <= 0 -> SessionPeriod.Today
                    days == 1 -> SessionPeriod.Yesterday
                    days <= 6 -> SessionPeriod.Last7Days
                    else -> SessionPeriod.Earlier
                }
            }
    return SessionPeriod.entries.mapNotNull { period ->
        byPeriod[period]?.let { SessionGroup(period, it) }
    }
}

/**
 * The compact time in [timeZone] of [updatedAt], an epoch millisecond: `HH:mm` on [today], `MM-DD`
 * in its year, else `YYYY-MM-DD`; empty when [updatedAt] is unset.
 */
internal fun formatSessionTime(updatedAt: Long, today: LocalDate, timeZone: TimeZone): String {
    if (updatedAt <= 0) return ""
    val time = Instant.fromEpochMilliseconds(updatedAt).toLocalDateTime(timeZone)
    val format =
        when {
            time.date == today -> clockFormat
            time.year == today.year -> monthDayFormat
            else -> dateFormat
        }
    return time.format(format)
}
