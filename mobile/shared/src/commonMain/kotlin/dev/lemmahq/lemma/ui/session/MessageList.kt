package dev.lemmahq.lemma.ui.session

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.theme.LemmaTheme
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_arrow_down
import lemma.mobile.shared.generated.resources.session_scroll_to_bottom
import org.jetbrains.compose.resources.painterResource
import org.jetbrains.compose.resources.stringResource

/**
 * The shown [messages], oldest first, kept at the newest while the reader stays there: user
 * messages as bubbles, replies with their steps. Scrolling to the oldest calls [onReachOldest]; a
 * session without messages offers suggestions instead.
 */
@Composable
internal fun MessageList(
    messages: List<UiMessage>,
    providers: List<ClientProvider>,
    canRegenerate: Boolean,
    onRegenerate: (String) -> Unit,
    onPickSuggestion: (String) -> Unit,
    onReachOldest: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (messages.isEmpty()) {
        EmptyState(onPickSuggestion = onPickSuggestion, modifier = modifier.fillMaxSize())
        return
    }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val atNewest by remember {
        derivedStateOf {
            listState.firstVisibleItemIndex == 0 && listState.firstVisibleItemScrollOffset == 0
        }
    }
    var following by remember { mutableStateOf(true) }
    val lastAssistantId = messages.lastOrNull { it.role == MessageRole.Assistant }?.id
    val lastUserId = messages.lastOrNull { it.role == MessageRole.User }?.id
    val reachOldest by rememberUpdatedState(onReachOldest)

    LaunchedEffect(listState) {
        snapshotFlow { listState.isScrollInProgress }
            .collect { scrolling -> following = !scrolling && atNewest }
    }
    LaunchedEffect(lastUserId) {
        following = true
        listState.scrollToItem(0)
    }
    LaunchedEffect(messages.size, messages.last().id) {
        if (following) listState.scrollToItem(0)
    }
    LaunchedEffect(listState) {
        snapshotFlow {
            val info = listState.layoutInfo
            info.visibleItemsInfo.any { it.index == info.totalItemsCount - 1 }
        }
            .distinctUntilChanged()
            .collect { reachedOldest -> if (reachedOldest) reachOldest() }
    }

    Box(modifier = modifier) {
        LazyColumn(
            state = listState,
            reverseLayout = true,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.Top),
        ) {
            items(messages.asReversed(), key = { it.id }) { message ->
                if (message.role == MessageRole.User) {
                    UserMessage(message.content)
                } else {
                    AssistantMessage(
                        message = message,
                        source = messageSource(message, providers),
                        onRegenerate =
                            if (canRegenerate && message.id == lastAssistantId) {
                                { onRegenerate(message.id) }
                            } else {
                                null
                            },
                    )
                }
            }
        }
        ScrollToNewestButton(
            visible = !atNewest,
            onClick = { scope.launch { listState.animateScrollToItem(0) } },
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 12.dp),
        )
    }
}

@Composable
private fun ScrollToNewestButton(
    visible: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn() + scaleIn(initialScale = 0.9f),
        exit = fadeOut() + scaleOut(targetScale = 0.9f),
        modifier = modifier,
    ) {
        IconButton(
            onClick = onClick,
            modifier =
                Modifier.size(40.dp)
                    .shadow(4.dp, CircleShape)
                    .clip(CircleShape)
                    .background(LemmaTheme.colors.backgroundGroup)
                    .border(1.dp, LemmaTheme.colors.separator, CircleShape),
        ) {
            Icon(
                painter = painterResource(Res.drawable.icon_arrow_down),
                contentDescription = stringResource(Res.string.session_scroll_to_bottom),
                tint = LemmaTheme.colors.textPrimary,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}

/** Who wrote [message]: the provider's name and the model, or the model alone. */
internal fun messageSource(message: UiMessage, providers: List<ClientProvider>): String? {
    val model = message.model?.takeIf { it.isNotEmpty() } ?: return null
    val name = providers.find { it.id == message.providerId }?.name
    return if (name.isNullOrEmpty()) model else "$name · $model"
}

@Composable
private fun UserMessage(text: String) {
    Box(
        modifier = Modifier.fillMaxWidth().padding(start = 48.dp),
        contentAlignment = Alignment.CenterEnd,
    ) {
        SelectionContainer {
            Text(
                text = text,
                color = LemmaTheme.colors.userBubbleText,
                style = LemmaTheme.typography.bodyLarge,
                modifier =
                    Modifier.clip(LemmaTheme.shapes.large)
                        .background(LemmaTheme.colors.userBubble)
                        .padding(horizontal = 14.dp, vertical = 10.dp),
            )
        }
    }
}
