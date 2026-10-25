package dev.lemmahq.lemma.ui.chat

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.data.LocalChatRepository
import dev.lemmahq.lemma.network.ErrorFormatter
import dev.lemmahq.lemma.ui.components.LemmaBubbleRole
import dev.lemmahq.lemma.ui.components.LemmaInput
import kotlinx.coroutines.launch

@Composable
internal fun ChatComposer(
    state: ChatState,
    client: LemmaClient,
    localChatRepository: LocalChatRepository,
    stopDescription: String,
    abortedNotice: String,
    modifier: Modifier = Modifier,
) {
    val scope = rememberCoroutineScope()
    Box(modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
        LemmaInput(
            value = state.inputText,
            onValueChange = { state.inputText = it },
            isStreaming = state.isStreaming && state.streamingMessageId != null,
            stopDescription = stopDescription,
            onStop = {
                val messageId = state.streamingMessageId ?: return@LemmaInput
                scope.launch {
                    try {
                        client.abortMessage(messageId)
                    } catch (e: Exception) {
                        state.bannerErrorMessage = ErrorFormatter.format(e)
                    }
                }
            },
            onSend = {
                val text = state.inputText.trim()
                if (text.isBlank() || state.isStreaming) return@LemmaInput
                if (state.selectedProviderId.isBlank() || state.selectedModel.isBlank()) {
                    state.bannerErrorMessage = "Select a model first"
                    return@LemmaInput
                }
                state.inputText = ""

                scope.launch {
                    var conv = state.currentConversation
                    if (conv == null) {
                        try {
                            conv = client.createConversation()
                            state.currentConversation = conv
                            state.conversations.add(0, conv)
                        } catch (e: Exception) {
                            state.bannerErrorMessage = ErrorFormatter.format(e)
                            return@launch
                        }
                    }

                    val userMsgId = "local_user_${state.messages.size}"
                    val aiMsgId = "local_ai_${state.messages.size + 1}"

                    state.messages.add(
                        UiMessage(id = userMsgId, role = LemmaBubbleRole.User, text = text)
                    )
                    state.messages.add(
                        UiMessage(id = aiMsgId, role = LemmaBubbleRole.Assistant, text = "")
                    )
                    localChatRepository.saveMessage(
                        id = userMsgId,
                        conversationId = conv.id,
                        role = 1L,
                        content = text,
                        status = 0L,
                        createdAt = 0L,
                        updatedAt = 0L,
                    )

                    state.isStreaming = true

                    try {
                        client
                            .sendMessage(
                                conv.id,
                                text,
                                state.selectedProviderId,
                                state.selectedModel,
                                userMsgId,
                            )
                            .collect { event ->
                                val lastIdx = state.messages.indexOfLast { it.id == aiMsgId }
                                when (event) {
                                    is AgentStreamEvent.Started -> {
                                        state.streamingMessageId = event.messageId
                                    }
                                    is AgentStreamEvent.Delta -> {
                                        if (lastIdx >= 0) {
                                            val old = state.messages[lastIdx]
                                            state.messages[lastIdx] =
                                                old.copy(text = old.text + event.text)
                                        }
                                    }
                                    is AgentStreamEvent.Done -> {
                                        if (lastIdx >= 0) {
                                            val aiText = state.messages[lastIdx].text
                                            localChatRepository.saveMessage(
                                                id = aiMsgId,
                                                conversationId = conv.id,
                                                role = 2L,
                                                content = aiText,
                                                status = 2L,
                                                createdAt = 0L,
                                                updatedAt = 0L,
                                            )
                                        }
                                    }
                                    is AgentStreamEvent.Aborted -> {
                                        if (lastIdx >= 0) {
                                            val old = state.messages[lastIdx]
                                            state.messages[lastIdx] =
                                                old.copy(
                                                    text =
                                                        if (old.text.isBlank()) "[$abortedNotice]"
                                                        else old.text + "\n[$abortedNotice]"
                                                )
                                        }
                                    }
                                    is AgentStreamEvent.Error -> {
                                        if (lastIdx >= 0) {
                                            val old = state.messages[lastIdx]
                                            state.messages[lastIdx] =
                                                old.copy(
                                                    text = old.text + "\n[Error: ${event.message}]"
                                                )
                                        }
                                    }
                                    else -> {}
                                }
                            }
                    } catch (e: Exception) {
                        val formattedError = ErrorFormatter.format(e)
                        state.bannerErrorMessage = formattedError
                        state.lastFailedText = text
                        val lastIdx = state.messages.indexOfLast { it.id == aiMsgId }
                        if (lastIdx >= 0) {
                            val old = state.messages[lastIdx]
                            state.messages[lastIdx] =
                                old.copy(
                                    text =
                                        old.text +
                                            if (old.text.isBlank()) "[Failed: $formattedError]"
                                            else "\n\n[Interrupted: $formattedError]"
                                )
                        }
                    } finally {
                        state.isStreaming = false
                        state.streamingMessageId = null
                    }
                }
            },
        )
    }
}
