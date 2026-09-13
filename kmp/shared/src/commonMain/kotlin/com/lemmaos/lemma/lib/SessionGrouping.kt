package com.lemmaos.lemma.lib

import com.lemmaos.lemma.domain.Conversation
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.atStartOfDayIn
import kotlinx.datetime.toLocalDateTime

enum class GroupKey {
    TODAY,
    YESTERDAY,
    LAST_7_DAYS,
    EARLIER,
}

data class SessionGroup(val key: GroupKey, val items: List<Conversation>)

private val GROUP_ORDER = listOf(
    GroupKey.TODAY,
    GroupKey.YESTERDAY,
    GroupKey.LAST_7_DAYS,
    GroupKey.EARLIER,
)
private const val DAY_MS = 24 * 60 * 60 * 1000L

private fun startOfDayMs(ms: Long, zone: TimeZone): Long {
    val date = Instant.fromEpochMilliseconds(ms).toLocalDateTime(zone).date
    return date.atStartOfDayIn(zone).toEpochMilliseconds()
}

fun groupSessions(
    sessions: List<Conversation>,
    nowMs: Long,
    zone: TimeZone = TimeZone.currentSystemDefault(),
): List<SessionGroup> {
    val today = startOfDayMs(nowMs, zone)
    val grouped = LinkedHashMap<GroupKey, MutableList<Conversation>>()
    for (s in sessions.sortedByDescending { it.updatedAtMs }) {
        val diff = (today - startOfDayMs(s.updatedAtMs, zone)) / DAY_MS
        val key = when {
            diff <= 0 -> GroupKey.TODAY
            diff == 1L -> GroupKey.YESTERDAY
            diff <= 6 -> GroupKey.LAST_7_DAYS
            else -> GroupKey.EARLIER
        }
        grouped.getOrPut(key) { mutableListOf() }.add(s)
    }
    return GROUP_ORDER.filter { grouped.containsKey(it) }.map { SessionGroup(it, grouped.getValue(it)) }
}
