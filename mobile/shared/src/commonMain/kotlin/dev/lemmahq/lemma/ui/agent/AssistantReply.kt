package dev.lemmahq.lemma.ui.agent

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.client.MessageStatus
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaCopyButton
import dev.lemmahq.lemma.ui.components.LemmaMarkdown
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.agent_aborted_notice
import lemma.mobile.shared.generated.resources.common_copy
import lemma.mobile.shared.generated.resources.icon_refresh_cw
import lemma.mobile.shared.generated.resources.session_regenerate
import org.jetbrains.compose.resources.painterResource
import org.jetbrains.compose.resources.stringResource

/**
 * The [reply] to one question: one timeline of the steps its messages took, then the last message's
 * text and how it ended. A failed reply shows no notice here; the composer's error dock reports it.
 * Tapping a step calls [onOpenStep], and opening a code block in the text calls [onOpenCode]. A
 * finished reply offers to copy its text, names its [source] model, and, when [onRegenerate] is
 * given, asks the model again.
 */
@Composable
internal fun AssistantReply(
    reply: MessageEntry.Reply,
    source: String?,
    onRegenerate: (() -> Unit)?,
    onOpenStep: (TurnStep) -> Unit,
    onOpenCode: (code: String, language: String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val message = reply.messages.last()
    val streaming = message.status == MessageStatus.Streaming
    val pending =
        streaming &&
            message.thinking.isEmpty() &&
            message.content.isEmpty() &&
            message.toolCalls.isEmpty()
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (reply.steps.isNotEmpty()) StepTimeline(reply.steps, reply.key, onOpenStep)
        if (pending) ThinkingLoader()
        if (message.content.isNotEmpty()) {
            SelectionContainer { LemmaMarkdown(content = message.content, onOpenCode = onOpenCode) }
        }
        if (message.status == MessageStatus.Aborted) {
            Text(
                text = stringResource(Res.string.agent_aborted_notice),
                style = LemmaTheme.typography.caption,
                color = LemmaTheme.colors.subtleForeground,
            )
        }
        if (message.status == MessageStatus.Done)
            MessageActions(message.content, source, onRegenerate)
    }
}

@Composable
private fun MessageActions(content: String, source: String?, onRegenerate: (() -> Unit)?) {
    val hasButton = content.isNotEmpty() || onRegenerate != null
    if (!hasButton && source == null) return
    Row(
        modifier = if (hasButton) Modifier.offset(x = (-14).dp) else Modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(if (hasButton) 2.dp else 0.dp),
    ) {
        if (content.isNotEmpty()) {
            LemmaCopyButton(
                text = content,
                label = stringResource(Res.string.common_copy),
                iconSize = 18.dp,
            )
        }
        if (onRegenerate != null) {
            IconButton(onClick = onRegenerate, modifier = Modifier.size(48.dp)) {
                Icon(
                    painter = painterResource(Res.drawable.icon_refresh_cw),
                    contentDescription = stringResource(Res.string.session_regenerate),
                    tint = LemmaTheme.colors.mutedForeground,
                    modifier = Modifier.size(18.dp),
                )
            }
        }
        source?.let {
            Text(
                text = it,
                style = LemmaTheme.typography.caption,
                color = LemmaTheme.colors.subtleForeground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = if (hasButton) Modifier.padding(start = 4.dp) else Modifier,
            )
        }
    }
}
