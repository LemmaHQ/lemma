package dev.lemmahq.lemma.ui.session

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaDisclosureChevron
import dev.lemmahq.lemma.ui.components.LemmaMarkdown
import dev.lemmahq.lemma.ui.components.LemmaSpinner
import dev.lemmahq.lemma.ui.components.lemmaDisclosure
import kotlinx.coroutines.delay
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.agent_thinking
import lemma.mobile.shared.generated.resources.agent_thinking_in_progress
import lemma.mobile.shared.generated.resources.agent_thinking_pending
import lemma.mobile.shared.generated.resources.agent_thought_for
import lemma.mobile.shared.generated.resources.icon_brain
import lemma.mobile.shared.generated.resources.icon_check
import org.jetbrains.compose.resources.DrawableResource
import org.jetbrains.compose.resources.painterResource
import org.jetbrains.compose.resources.stringResource

private const val AUTO_COLLAPSE_MILLIS = 1_000L

/**
 * The [message]'s thinking under a header that shows or hides it. While the reply is [streaming] it
 * starts open and closes once, a second after the thinking ends; the header counts the time spent
 * thinking.
 */
@Composable
internal fun MessageThinking(message: UiMessage, streaming: Boolean) {
    val inProgress = streaming && message.content.isEmpty() && message.thinkingFinishedAt == null
    val openedWhileStreaming = rememberSaveable(message.id) { streaming }
    var expanded by rememberSaveable(message.id) { mutableStateOf(streaming) }
    var autoCollapsed by rememberSaveable(message.id) { mutableStateOf(false) }
    val autoCollapse = openedWhileStreaming && !inProgress && expanded && !autoCollapsed
    LaunchedEffect(inProgress, expanded) {
        if (autoCollapse) {
            delay(AUTO_COLLAPSE_MILLIS)
            expanded = false
            autoCollapsed = true
        }
    }
    val elapsed = rememberElapsed(message.thinkingStartedAt, message.thinkingFinishedAt)
    val duration = elapsed?.takeIf { message.thinkingFinishedAt != null }
    Column {
        Row(
            modifier =
                Modifier.heightIn(min = 40.dp)
                    .clip(LemmaTheme.shapes.medium)
                    .lemmaDisclosure(expanded) {
                        autoCollapsed = true
                        expanded = !expanded
                    }
                    .padding(end = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            when {
                inProgress -> LemmaSpinner()
                duration != null -> ThinkingIcon(Res.drawable.icon_check)
                else -> ThinkingIcon(Res.drawable.icon_brain)
            }
            Text(
                text =
                    when {
                        inProgress ->
                            stringResource(Res.string.agent_thinking_in_progress) +
                                elapsed?.let { " " + formatDuration(it, live = true) }.orEmpty()
                        duration != null ->
                            stringResource(Res.string.agent_thought_for, formatDuration(duration))
                        else -> stringResource(Res.string.agent_thinking)
                    },
                style = LemmaTheme.typography.bodyMedium,
                color = LemmaTheme.colors.textSecondary,
            )
            LemmaDisclosureChevron(expanded)
        }
        AnimatedVisibility(expanded) { ThinkingText(message.thinking) }
    }
}

/** Shows that the model works on a reply that has nothing to show yet. */
@Composable
internal fun ThinkingLoader() {
    val pulse by
        rememberInfiniteTransition()
            .animateFloat(
                initialValue = 1f,
                targetValue = 0.45f,
                animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
            )
    Row(
        modifier =
            Modifier.heightIn(min = 32.dp)
                .border(1.dp, LemmaTheme.colors.separator, LemmaTheme.shapes.full)
                .padding(horizontal = 12.dp)
                .semantics { liveRegion = LiveRegionMode.Polite },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        LemmaSpinner()
        Text(
            text = stringResource(Res.string.agent_thinking_pending),
            style = LemmaTheme.typography.bodyMedium,
            color = LemmaTheme.colors.textSecondary,
            modifier = Modifier.alpha(pulse),
        )
    }
}

@Composable
private fun ThinkingIcon(icon: DrawableResource) {
    Icon(
        painter = painterResource(icon),
        contentDescription = null,
        tint = LemmaTheme.colors.textSecondary,
        modifier = Modifier.size(16.dp),
    )
}

@Composable
private fun ThinkingText(thinking: String) {
    Box(modifier = Modifier.padding(top = 4.dp, bottom = 8.dp)) {
        Box(
            modifier =
                Modifier.matchParentSize()
                    .padding(top = 6.dp, bottom = 6.dp)
                    .wrapContentWidth(Alignment.Start)
                    .padding(start = 3.dp)
                    .width(1.dp)
                    .fillMaxHeight()
                    .background(LemmaTheme.colors.separator)
        )
        Box(
            modifier =
                Modifier.padding(top = 2.5.dp)
                    .size(7.dp)
                    .clip(LemmaTheme.shapes.full)
                    .background(LemmaTheme.colors.textTertiary)
        )
        LemmaMarkdown(
            content = thinking,
            color = LemmaTheme.colors.textSecondary,
            style = LemmaTheme.typography.bodyMedium,
            modifier = Modifier.padding(start = 20.dp),
        )
    }
}
