package dev.lemmahq.lemma.ui.session

import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.data.LocalMessageRepository
import dev.lemmahq.lemma.network.ErrorFormatter
import dev.lemmahq.lemma.ui.components.LemmaBubbleRole
import kotlinx.coroutines.CancellationException

internal suspend fun loadOlderMessages(
    state: SessionState,
    client: LemmaClient,
    localMessageRepository: LocalMessageRepository,
) {
    val sessionId = state.currentSession?.id ?: return
    val beforeId = state.messages.firstOrNull()?.id ?: return
    state.isLoadingOlderMessages = true
    try {
        val page = client.listMessages(sessionId, beforeId)
        if (state.currentSession?.id != sessionId) return
        for (message in page.messages) {
            localMessageRepository.saveMessage(
                id = message.id,
                sessionId = sessionId,
                role = if (message.role == "user") 1L else 2L,
                content = message.content,
                createdAt = message.createdAtSeconds,
            )
        }
        if (state.currentSession?.id != sessionId) return
        state.messages.addAll(
            0,
            page.messages.asReversed().map {
                UiMessage(
                    id = it.id,
                    role =
                        if (it.role == "user") LemmaBubbleRole.User else LemmaBubbleRole.Assistant,
                    text = it.content,
                )
            },
        )
        state.hasOlderMessages = page.hasMore
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        state.bannerErrorMessage = ErrorFormatter.format(e)
    } finally {
        state.isLoadingOlderMessages = false
    }
}
