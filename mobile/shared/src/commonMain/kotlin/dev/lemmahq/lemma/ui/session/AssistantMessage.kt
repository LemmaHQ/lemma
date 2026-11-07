package dev.lemmahq.lemma.ui.session

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
import lemma.mobile.shared.generated.resources.agent_failed
import lemma.mobile.shared.generated.resources.common_copy
import lemma.mobile.shared.generated.resources.icon_refresh_cw
import lemma.mobile.shared.generated.resources.session_regenerate
import org.jetbrains.compose.resources.painterResource
import org.jetbrains.compose.resources.stringResource

/**
 * One assistant step: its thinking, its text, the tools it called, and how it ended. A settled step
 * offers to copy its text, names its [source] model, and, when [onRegenerate] is given, asks the
 * model again.
 */
@Composable
internal fun AssistantMessage(
    message: UiMessage,
    source: String?,
    onRegenerate: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val streaming = message.status == MessageStatus.Streaming
    val pending =
        streaming &&
            message.thinking.isEmpty() &&
            message.content.isEmpty() &&
            message.toolCalls.isEmpty()
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        when {
            pending -> ThinkingLoader()
            message.thinking.isNotEmpty() -> MessageThinking(message, streaming)
        }
        if (message.content.isNotEmpty()) {
            SelectionContainer { LemmaMarkdown(content = message.content) }
        }
        if (message.toolCalls.isNotEmpty()) ToolCallList(message.toolCalls, message.id)
        if (message.status == MessageStatus.Aborted) {
            Text(
                text = stringResource(Res.string.agent_aborted_notice),
                style = LemmaTheme.typography.labelSmall,
                color = LemmaTheme.colors.textTertiary,
            )
        }
        if (message.status == MessageStatus.Error) FailureNotice(message)
        if (!streaming) MessageActions(message.content, source, onRegenerate)
    }
}

@Composable
private fun FailureNotice(message: UiMessage) {
    Column {
        Text(
            text = stringResource(Res.string.agent_failed),
            style = LemmaTheme.typography.bodyMedium,
            color = LemmaTheme.colors.danger,
        )
        message.error
            ?.text()
            ?.takeIf { it.isNotBlank() }
            ?.let {
                Text(
                    text = it,
                    style = LemmaTheme.typography.labelSmall,
                    color = LemmaTheme.colors.textTertiary,
                )
            }
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
                    tint = LemmaTheme.colors.textSecondary,
                    modifier = Modifier.size(18.dp),
                )
            }
        }
        source?.let {
            Text(
                text = it,
                style = LemmaTheme.typography.labelSmall,
                color = LemmaTheme.colors.textTertiary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = if (hasButton) Modifier.padding(start = 4.dp) else Modifier,
            )
        }
    }
}
