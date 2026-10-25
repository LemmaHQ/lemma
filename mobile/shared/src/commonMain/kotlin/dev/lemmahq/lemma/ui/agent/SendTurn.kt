package dev.lemmahq.lemma.ui.agent

import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.data.LocalMessageRepository
import dev.lemmahq.lemma.network.ErrorFormatter
import dev.lemmahq.lemma.ui.components.LemmaBubbleRole

internal suspend fun sendTurn(
    state: AgentState,
    client: LemmaClient,
    localMessageRepository: LocalMessageRepository,
    text: String,
    abortedNotice: String,
) {
    var conv = state.currentConversation
    if (conv == null) {
        try {
            conv = client.createConversation()
            state.currentConversation = conv
            state.conversations.add(0, conv)
        } catch (e: Exception) {
            state.bannerErrorMessage = ErrorFormatter.format(e)
            return
        }
    }

    val userMsgId = "local_user_${state.messages.size}"
    val aiMsgId = "local_ai_${state.messages.size + 1}"

    state.messages.add(UiMessage(id = userMsgId, role = LemmaBubbleRole.User, text = text))
    state.messages.add(UiMessage(id = aiMsgId, role = LemmaBubbleRole.Assistant, text = ""))
    localMessageRepository.saveMessage(
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
            .sendMessage(conv.id, text, state.selectedProviderId, state.selectedModel, userMsgId)
            .collect { event ->
                val lastIdx = state.messages.indexOfLast { it.id == aiMsgId }
                when (event) {
                    is AgentStreamEvent.Started -> {
                        state.streamingMessageId = event.messageId
                    }
                    is AgentStreamEvent.Delta -> {
                        if (lastIdx >= 0) {
                            val old = state.messages[lastIdx]
                            state.messages[lastIdx] = old.copy(text = old.text + event.text)
                        }
                    }
                    is AgentStreamEvent.Done -> {
                        if (lastIdx >= 0) {
                            val aiText = state.messages[lastIdx].text
                            localMessageRepository.saveMessage(
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
                                old.copy(text = old.text + "\n[Error: ${event.message}]")
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
