package dev.lemmahq.lemma.ui.session

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaDisclosureChevron
import dev.lemmahq.lemma.ui.components.LemmaSpinner
import dev.lemmahq.lemma.ui.components.lemmaDisclosure
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.agent_tool_announce_error
import lemma.mobile.shared.generated.resources.agent_tool_announce_running
import lemma.mobile.shared.generated.resources.agent_tool_announce_success
import lemma.mobile.shared.generated.resources.agent_tool_arguments
import lemma.mobile.shared.generated.resources.agent_tool_copy_arguments
import lemma.mobile.shared.generated.resources.agent_tool_copy_result
import lemma.mobile.shared.generated.resources.agent_tool_error_fallback
import lemma.mobile.shared.generated.resources.agent_tool_failed
import lemma.mobile.shared.generated.resources.agent_tool_output
import lemma.mobile.shared.generated.resources.agent_tool_waiting
import lemma.mobile.shared.generated.resources.icon_check
import lemma.mobile.shared.generated.resources.icon_circle_alert
import lemma.mobile.shared.generated.resources.icon_wrench
import org.jetbrains.compose.resources.DrawableResource
import org.jetbrains.compose.resources.painterResource
import org.jetbrains.compose.resources.stringResource

private val SMALL_RADIUS = RoundedCornerShape(8.dp)

/**
 * One tool call: its name, status, and duration over its arguments and result, which it shows on
 * request. A failed call opens to its error; screen readers hear each status change.
 */
@Composable
internal fun ToolCallCard(call: UiToolCall) {
    var open by rememberSaveable(call.id, call.isError) { mutableStateOf(call.isError) }
    val error = call.output.ifEmpty { stringResource(Res.string.agent_tool_error_fallback) }
    Column(
        modifier =
            Modifier.fillMaxWidth()
                .border(1.dp, LemmaTheme.colors.separator, LemmaTheme.shapes.medium)
                .clip(LemmaTheme.shapes.medium)
    ) {
        ToolCallHeader(call = call, error = error, open = open, onToggle = { open = !open })
        AnimatedVisibility(open) { ToolCallDetails(call = call, error = error) }
    }
}

@Composable
private fun ToolCallHeader(call: UiToolCall, error: String, open: Boolean, onToggle: () -> Unit) {
    val announcement =
        when {
            call.running -> stringResource(Res.string.agent_tool_announce_running, call.name)
            call.isError -> stringResource(Res.string.agent_tool_announce_error, call.name, error)
            else -> stringResource(Res.string.agent_tool_announce_success, call.name)
        }
    Row(
        modifier =
            Modifier.fillMaxWidth()
                .heightIn(min = 48.dp)
                .lemmaDisclosure(open, onToggle)
                .semantics {
                    contentDescription = announcement
                    liveRegion = LiveRegionMode.Polite
                }
                .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        ToolIcon()
        Text(
            text = call.name,
            style =
                LemmaTheme.typography.labelSmall.copy(
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Medium,
                ),
            color = LemmaTheme.colors.textPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        ToolStatus(call, rememberElapsed(call.startedAt, call.finishedAt))
        LemmaDisclosureChevron(open)
    }
}

@Composable
private fun ToolCallDetails(call: UiToolCall, error: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(LemmaTheme.colors.separator))
        Column(
            modifier = Modifier.padding(start = 12.dp, top = 8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            if (call.isError) ToolError(error)
            if (call.arguments.isNotBlank()) {
                ToolCallSection(
                    label = stringResource(Res.string.agent_tool_arguments),
                    copyLabel = stringResource(Res.string.agent_tool_copy_arguments),
                    text = call.arguments,
                )
            }
            when {
                call.running -> ToolWaiting()
                !call.isError ->
                    ToolCallSection(
                        label = stringResource(Res.string.agent_tool_output),
                        copyLabel = stringResource(Res.string.agent_tool_copy_result),
                        text = call.output,
                    )
            }
        }
    }
}

@Composable
private fun ToolWaiting() {
    Column(modifier = Modifier.padding(end = 12.dp, bottom = 8.dp)) {
        Text(
            text = stringResource(Res.string.agent_tool_output),
            style = LemmaTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = LemmaTheme.colors.textSecondary,
        )
        Text(
            text = stringResource(Res.string.agent_tool_waiting),
            style = LemmaTheme.typography.labelSmall,
            color = LemmaTheme.colors.textTertiary,
        )
    }
}

/** The wrench badge that marks a tool call. */
@Composable
internal fun ToolIcon(modifier: Modifier = Modifier, size: Dp = 26.dp) {
    Box(
        modifier =
            modifier
                .size(size)
                .clip(SMALL_RADIUS)
                .background(LemmaTheme.colors.background)
                .background(LemmaTheme.colors.fill2)
                .border(1.dp, LemmaTheme.colors.separator, SMALL_RADIUS),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            painter = painterResource(Res.drawable.icon_wrench),
            contentDescription = null,
            tint = LemmaTheme.colors.textPrimary,
            modifier = Modifier.size(size / 2),
        )
    }
}

@Composable
private fun ToolStatus(call: UiToolCall, elapsed: Long?) {
    val color = if (call.isError) LemmaTheme.colors.danger else LemmaTheme.colors.textSecondary
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        when {
            call.running -> LemmaSpinner()
            call.isError -> StatusIcon(Res.drawable.icon_circle_alert, LemmaTheme.colors.danger)
            else -> StatusIcon(Res.drawable.icon_check, LemmaTheme.colors.textPrimary)
        }
        val label =
            if (call.isError) stringResource(Res.string.agent_tool_failed)
            else elapsed?.let { formatDuration(it, live = call.running) }
        label?.let { Text(text = it, style = LemmaTheme.typography.labelSmall, color = color) }
    }
}

@Composable
private fun StatusIcon(icon: DrawableResource, tint: Color) {
    Icon(
        painter = painterResource(icon),
        contentDescription = null,
        tint = tint,
        modifier = Modifier.size(14.dp),
    )
}

@Composable
private fun ToolError(error: String) {
    Row(
        modifier =
            Modifier.fillMaxWidth()
                .padding(end = 12.dp, bottom = 4.dp)
                .clip(SMALL_RADIUS)
                .background(LemmaTheme.colors.danger.copy(alpha = 0.08f))
                .border(1.dp, LemmaTheme.colors.danger.copy(alpha = 0.3f), SMALL_RADIUS)
                .padding(10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        StatusIcon(Res.drawable.icon_circle_alert, LemmaTheme.colors.danger)
        Text(
            text = error,
            style = LemmaTheme.typography.labelSmall,
            color = LemmaTheme.colors.danger,
        )
    }
}
