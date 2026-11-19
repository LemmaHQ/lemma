package io.github.mistvesper.lemma.ui.agent

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.theme.LemmaTheme
import io.github.mistvesper.lemma.ui.components.LemmaBottomSheet
import io.github.mistvesper.lemma.ui.components.LemmaMarkdown
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.agent_step_details
import lemma.mobile.shared.generated.resources.agent_tool_call_waiting
import org.jetbrains.compose.resources.stringResource

/**
 * A sheet showing [step] in full under its verb, argument, and backend or failure: the whole
 * reasoning, highlighted code, the web results, or the command output.
 */
@Composable
internal fun StepDetailSheet(step: TurnStep, onDismiss: () -> Unit) {
    LemmaBottomSheet(onDismiss = onDismiss, title = stringResource(Res.string.agent_step_details)) {
        StepHeader(step)
        Spacer(modifier = Modifier.height(12.dp))
        Column(modifier = Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState())) {
            StepDetailBody(step)
        }
    }
}

@Composable
private fun StepDetailBody(step: TurnStep) {
    detailContent(step)()
}

private fun detailContent(step: TurnStep): @Composable () -> Unit =
    when (val detail = step.detail) {
        is StepDetail.Prose -> {
            { ProseDetail(detail.text) }
        }
        is StepDetail.Code -> {
            { CodeView(detail.code, detail.language) }
        }
        is StepDetail.Web -> {
            { WebDetail(detail) }
        }
        is StepDetail.Output -> {
            { OutputDetail(step, detail.text) }
        }
    }

@Composable
private fun ProseDetail(text: String) {
    SelectionContainer {
        LemmaMarkdown(
            content = text,
            color = LemmaTheme.colors.mutedForeground,
            style = LemmaTheme.typography.body,
        )
    }
}

@Composable
private fun StepHeader(step: TurnStep) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = stepVerb(step).text(),
            style = LemmaTheme.typography.caption.copy(fontWeight = FontWeight.Medium),
            color = LemmaTheme.colors.mutedForeground,
            maxLines = 1,
            modifier =
                Modifier.clip(LemmaTheme.shapes.sm)
                    .background(LemmaTheme.colors.muted)
                    .padding(horizontal = 6.dp, vertical = 2.dp),
        )
        SelectionContainer(modifier = Modifier.weight(1f)) {
            Text(
                text = stepArgument(step).text(),
                style = stepArgumentStyle(step),
                color = LemmaTheme.colors.foreground,
            )
        }
        (stepFailure(step)?.text() ?: step.via)?.let {
            Text(
                text = it,
                style = LemmaTheme.typography.caption,
                color = LemmaTheme.colors.subtleForeground,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun WebDetail(detail: StepDetail.Web) {
    val uriHandler = LocalUriHandler.current
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        detail.note?.let {
            Text(
                text = it,
                style = LemmaTheme.typography.small,
                color = LemmaTheme.colors.mutedForeground,
            )
        }
        for (hit in detail.hits) {
            Column(
                modifier =
                    Modifier.fillMaxWidth()
                        .clip(LemmaTheme.shapes.md)
                        .border(1.dp, LemmaTheme.colors.border, LemmaTheme.shapes.md)
                        .clickable(enabled = hit.url.isNotEmpty()) { uriHandler.openUri(hit.url) }
                        .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = hit.title,
                    style = LemmaTheme.typography.body.copy(fontWeight = FontWeight.Medium),
                    color = LemmaTheme.colors.foreground,
                )
                Text(
                    text = hit.url,
                    style = LemmaTheme.typography.caption.copy(fontFamily = FontFamily.Monospace),
                    color = LemmaTheme.colors.brand,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (hit.snippet.isNotEmpty()) {
                    Text(
                        text = hit.snippet,
                        style = LemmaTheme.typography.small,
                        color = LemmaTheme.colors.mutedForeground,
                    )
                }
            }
        }
    }
}

@Composable
private fun OutputDetail(step: TurnStep, text: String) {
    if (step.running && text.isEmpty()) {
        Text(
            text = stringResource(Res.string.agent_tool_call_waiting),
            style = LemmaTheme.typography.small,
            color = LemmaTheme.colors.subtleForeground,
        )
    } else {
        SelectionContainer {
            Text(
                text = text,
                style = LemmaTheme.typography.small.copy(fontFamily = FontFamily.Monospace),
                color =
                    if (step.isError) LemmaTheme.colors.destructive
                    else LemmaTheme.colors.foreground,
                modifier =
                    Modifier.fillMaxWidth()
                        .clip(LemmaTheme.shapes.md)
                        .border(1.dp, LemmaTheme.colors.border, LemmaTheme.shapes.md)
                        .background(LemmaTheme.colors.muted)
                        .padding(12.dp),
            )
        }
    }
}
