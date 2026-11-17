package dev.lemmahq.lemma.ui.agent

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaDisclosureChevron
import dev.lemmahq.lemma.ui.components.lemmaDisclosure
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.agent_step_count
import org.jetbrains.compose.resources.pluralStringResource

/**
 * A reply's thinking and tool calls in the order they happened, collapsed under a summary of what
 * it did and how many steps it took. Each row names its step's verb, argument, backend, and
 * failure; tapping a row calls [onOpenStep]. [key] keeps the open state across recompositions.
 */
@Composable
internal fun StepTimeline(steps: List<TurnStep>, key: String, onOpenStep: (TurnStep) -> Unit) {
    var open by rememberSaveable(key) { mutableStateOf(false) }
    val summary =
        stepSummary(steps)
            .map { it.text() }
            .joinToString(" · ")
            .ifEmpty {
                pluralStringResource(Res.plurals.agent_step_count, steps.size, steps.size)
            }
    Column {
        Row(
            modifier =
                Modifier.fillMaxWidth()
                    .heightIn(min = 40.dp)
                    .clip(LemmaTheme.shapes.md)
                    .lemmaDisclosure(open) { open = !open }
                    .semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite }
                    .padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = summary,
                style = LemmaTheme.typography.small.copy(fontWeight = FontWeight.Medium),
                color = LemmaTheme.colors.mutedForeground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f, fill = false),
            )
            Text(
                text = pluralStringResource(Res.plurals.agent_step_count, steps.size, steps.size),
                style = LemmaTheme.typography.caption,
                color = LemmaTheme.colors.subtleForeground,
                maxLines = 1,
            )
            LemmaDisclosureChevron(open)
        }
        AnimatedVisibility(open) {
            Column(modifier = Modifier.padding(top = 2.dp)) {
                for (step in steps) StepRow(step) { onOpenStep(step) }
            }
        }
    }
}

@Composable
private fun StepRow(step: TurnStep, onClick: () -> Unit) {
    Row(
        modifier =
            Modifier.fillMaxWidth()
                .heightIn(min = 40.dp)
                .clip(LemmaTheme.shapes.md)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = stepVerb(step).text(),
            style = LemmaTheme.typography.caption.copy(fontWeight = FontWeight.Medium),
            color =
                if (step.isError) LemmaTheme.colors.warning else LemmaTheme.colors.mutedForeground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.width(64.dp),
        )
        Text(
            text = stepArgument(step).text(),
            style = stepArgumentStyle(step),
            color = LemmaTheme.colors.foreground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        step.via?.let {
            Text(
                text = it,
                style = LemmaTheme.typography.caption,
                color = LemmaTheme.colors.subtleForeground,
                maxLines = 1,
            )
        }
        stepFailure(step)?.let {
            Text(
                text = it.text(),
                style = LemmaTheme.typography.caption,
                color = LemmaTheme.colors.subtleForeground,
                maxLines = 1,
            )
        }
    }
}

/** The style of [step]'s argument: body text for prose, monospaced captions for code. */
@Composable
@ReadOnlyComposable
internal fun stepArgumentStyle(step: TurnStep) =
    if (step.plainArgument) LemmaTheme.typography.small
    else LemmaTheme.typography.caption.copy(fontFamily = FontFamily.Monospace)
