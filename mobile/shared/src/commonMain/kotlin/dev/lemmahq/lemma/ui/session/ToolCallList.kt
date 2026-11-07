package dev.lemmahq.lemma.ui.session

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaDisclosureChevron
import dev.lemmahq.lemma.ui.components.lemmaDisclosure
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.agent_tool_group_failed
import lemma.mobile.shared.generated.resources.agent_tool_group_running
import lemma.mobile.shared.generated.resources.agent_tool_group_used
import org.jetbrains.compose.resources.pluralStringResource
import org.jetbrains.compose.resources.stringResource

private const val SHOWN_ICONS = 3

/**
 * The tools a step called, collapsed under a summary of how many ran, how many failed, and how long
 * they took together; screen readers hear the summary change.
 */
@Composable
internal fun ToolCallList(calls: List<UiToolCall>, stepId: String) {
    var open by rememberSaveable(stepId) { mutableStateOf(false) }
    val running = calls.any { it.running }
    val failed = calls.count { it.isError }
    val total = totalDuration(calls)
    Column {
        Row(
            modifier =
                Modifier.heightIn(min = 40.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .lemmaDisclosure(open) { open = !open }
                    .semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite }
                    .padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box {
                calls.takeLast(SHOWN_ICONS).forEachIndexed { index, _ ->
                    ToolIcon(
                        size = 24.dp,
                        modifier =
                            Modifier.padding(start = (20 * index).dp)
                                .border(
                                    2.dp,
                                    LemmaTheme.colors.background,
                                    RoundedCornerShape(8.dp),
                                ),
                    )
                }
            }
            Text(
                text =
                    pluralStringResource(
                        if (running) Res.plurals.agent_tool_group_running
                        else Res.plurals.agent_tool_group_used,
                        calls.size,
                        calls.size,
                    ),
                style = LemmaTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                color = LemmaTheme.colors.textSecondary,
                maxLines = 1,
            )
            if (failed > 0) {
                Text(
                    text = "· " + stringResource(Res.string.agent_tool_group_failed, failed),
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.danger,
                    maxLines = 1,
                )
            }
            total?.let {
                Text(
                    text = "· " + formatDuration(it, live = running),
                    style = LemmaTheme.typography.bodyMedium,
                    color = LemmaTheme.colors.textSecondary,
                    maxLines = 1,
                )
            }
            LemmaDisclosureChevron(open)
        }
        AnimatedVisibility(open) {
            Column(
                modifier = Modifier.padding(top = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                for (call in calls) ToolCallCard(call)
            }
        }
    }
}

/**
 * How long [calls] took together, counting running calls up to now; null while a call lacks the
 * instant it started, or a finished call the instant it ended.
 */
@Composable
private fun totalDuration(calls: List<UiToolCall>): Long? {
    val activeStart = calls.filter { it.running }.mapNotNull { it.startedAt }.minOrNull()
    val now = rememberElapsed(activeStart, null)?.let { activeStart?.plus(it) }
    val durations = calls.map { call ->
        val startedAt = call.startedAt ?: return@map null
        when {
            call.finishedAt != null -> (call.finishedAt - startedAt).coerceAtLeast(0)
            call.running && now != null -> (now - startedAt).coerceAtLeast(0)
            else -> null
        }
    }
    if (calls.isEmpty() || durations.any { it == null }) return null
    return durations.sumOf { it ?: 0 }
}
