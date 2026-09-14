package com.lemmaos.lemma.ui.chat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.lemmaos.lemma.domain.ChatMessage
import com.lemmaos.lemma.domain.MessageStatusKind
import androidx.compose.foundation.background
import com.lemmaos.lemma.ui.LocalLemmaColors
import com.lemmaos.lemma.i18n.I18n
import com.lemmaos.lemma.domain.Provider

@Composable
fun ChatPane(
    state: ChatUiState,
    modelChoice: ModelChoice?,
    providers: List<Provider>,
    onSelectModel: (ModelChoice) -> Unit,
    onSend: (String) -> Unit,
    onAbort: () -> Unit,
    onLoadMore: () -> Unit,
) {
    var input by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    LaunchedEffect(state.items.size) {
        if (state.items.isNotEmpty()) {
            listState.animateScrollToItem(state.items.lastIndex)
        }
    }

    Column {
        if (state.hasMore) {
            androidx.compose.material3.TextButton(
                onClick = onLoadMore,
                modifier = Modifier.align(Alignment.CenterHorizontally),
            ) {
                Text(I18n.t("chat.loadMore"))
            }
        }

        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(state.items, key = { it.id }) { message ->
                MessageBubble(message)
            }
        }

        state.error?.let {
            Text(
                it,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth()
                .background(LocalLemmaColors.current.composer)
                .padding(12.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            ModelPicker(
                providers = providers,
                selection = modelChoice,
                onSelect = onSelectModel,
            )
            Spacer(Modifier.width(8.dp))
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                placeholder = { Text(I18n.t("chat.message")) },
                modifier = Modifier.weight(1f),
                maxLines = 6,
                enabled = !state.streaming,
            )
            Spacer(Modifier.width(8.dp))
            if (state.streaming) {
                IconButton(onClick = onAbort) {
                    Icon(Icons.Filled.Stop, contentDescription = I18n.t("chat.stop"))
                }
            } else {
                IconButton(
                    onClick = {
                        val text = input.trim()
                        if (text.isNotEmpty() && modelChoice != null) {
                            input = ""
                            onSend(text)
                        }
                    },
                    enabled = input.isNotBlank() && modelChoice != null,
                ) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = I18n.t("chat.send"))
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(message: ChatMessage) {
    val isUser = message.role == "user"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        Surface(
            color = when {
                isUser -> MaterialTheme.colorScheme.primary
                message.status == MessageStatusKind.ERROR -> MaterialTheme.colorScheme.errorContainer
                else -> MaterialTheme.colorScheme.surfaceVariant
            },
            shape = MaterialTheme.shapes.medium,
            modifier = Modifier.widthIn(max = 560.dp),
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                if (!isUser && message.model.isNotEmpty()) {
                    Text(
                        message.model,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(4.dp))
                }
                Text(
                    message.content.ifBlank {
                        when (message.status) {
                            MessageStatusKind.STREAMING -> "…"
                            else -> " "
                        }
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = when {
                        isUser -> MaterialTheme.colorScheme.onPrimary
                        else -> MaterialTheme.colorScheme.onSurface
                    },
                )
                if (message.status == MessageStatusKind.STREAMING) {
                    CircularProgressIndicator(
                        modifier = Modifier.padding(top = 4.dp).height(14.dp).width(14.dp),
                        strokeWidth = 2.dp,
                    )
                }
                message.error?.let {
                    Text(
                        it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
                if (message.status == MessageStatusKind.ABORTED) {
                    Text(
                        "aborted",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
