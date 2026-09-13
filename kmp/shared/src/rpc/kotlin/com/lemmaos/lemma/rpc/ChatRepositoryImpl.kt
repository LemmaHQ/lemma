package com.lemmaos.lemma.rpc

import com.lemmaos.gen.lemma.v1.ChatEventKt
import com.lemmaos.gen.lemma.v1.MessageStatus
import com.lemmaos.gen.lemma.v1.chatEvent
import com.lemmaos.gen.lemma.v1.listMessagesRequest
import com.lemmaos.gen.lemma.v1.message
import com.lemmaos.gen.lemma.v1.sendMessageRequest
import com.lemmaos.gen.lemma.v1.resumeStreamRequest
import com.lemmaos.lemma.data.ChatRepository
import com.lemmaos.lemma.data.ChatState
import com.lemmaos.lemma.data.SessionStore
import com.lemmaos.lemma.domain.ChatMessage
import com.lemmaos.lemma.domain.MessageStatusKind
import com.lemmaos.lemma.ui.errorText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlin.random.Random

private const val PAGE_SIZE = 50
private const val MAX_RESUME = 3

// Counts code points, not UTF-16 code units: the server measures the resume
// offset in chars (Rust chars().skip()), so an emoji would misalign the
// replay if measured by String.length.
private fun charLen(s: String): Int {
    var count = 0
    var i = 0
    while (i < s.length) {
        val c = s[i]
        count++
        i += if (c.isHighSurrogate() && i + 1 < s.length && s[i + 1].isLowSurrogate()) 2 else 1
    }
    return count
}

private fun randomId(): String {
    val hex = "0123456789abcdef"
    return buildString {
        repeat(32) { append(hex[Random.nextInt(16)]) }
    }
}

class ChatRepositoryImpl(
    private val clients: ApiClients,
    private val session: SessionStore,
) : ChatRepository {

    private val scope = CoroutineScope(Dispatchers.Main + Job())

    private val _state = MutableStateFlow(ChatState())
    override val state: StateFlow<ChatState> = _state.asStateFlow()

    private var streamJob: Job? = null
    private var activeMessageId: String? = null
    private var userAborted = false

    override suspend fun open(conversationId: String) {
        val response = clients.conversations
            .listMessages(listMessagesRequest { this.conversationId = conversationId; limit = PAGE_SIZE }, emptyMap())
            .orThrowApp()
        _state.value = ChatState(
            conversationId = conversationId,
            items = response.messagesList.map { it.toChatMessage() }.asReversed(),
            hasMore = response.hasMore,
        )
    }

    override suspend fun loadMore() {
        val current = _state.value
        val conversationId = current.conversationId ?: return
        if (!current.hasMore || current.items.isEmpty()) return
        val response = clients.conversations
            .listMessages(
                listMessagesRequest {
                    this.conversationId = conversationId
                    beforeId = current.items.first().id
                    limit = PAGE_SIZE
                },
                emptyMap(),
            )
            .orThrowApp()
        _state.value = _state.value.copy(
            items = response.messagesList.map { it.toChatMessage() }.asReversed() + _state.value.items,
            hasMore = response.hasMore,
        )
    }

    override suspend fun send(providerId: String, model: String, content: String) {
        val conversationId = _state.value.conversationId ?: return
        if (_state.value.streaming) return

        val clientMsgId = randomId()
        val aiTempId = "$clientMsgId:ai"
        activeMessageId = null
        userAborted = false

        _state.value = _state.value.copy(
            streaming = true,
            error = null,
            items = _state.value.items + listOf(
                ChatMessage(
                    id = clientMsgId,
                    role = "user",
                    content = content,
                    status = MessageStatusKind.DONE,
                    providerId = "",
                    model = "",
                ),
                ChatMessage(
                    id = aiTempId,
                    role = "assistant",
                    content = "",
                    status = MessageStatusKind.STREAMING,
                    providerId = providerId,
                    model = model,
                ),
            ),
        )

        streamJob = scope.launch {
            try {
                var resumes = 0
                while (true) {
                    try {
                        if (activeMessageId == null) {
                            val stream = clients.chat.sendMessage(emptyMap())
                            stream.sendAndClose(
                                sendMessageRequest {
                                    this.conversationId = conversationId
                                    this.content = content
                                    this.providerId = providerId
                                    this.model = model
                                    this.clientMsgId = clientMsgId
                                },
                            )
                            for (response in stream.responseChannel()) {
                                applyEvent(response.event, aiTempId)
                            }
                        } else {
                            val current = _state.value.items
                                .firstOrNull { it.id == aiTempId }?.content.orEmpty()
                            val stream = clients.chat.resumeStream(emptyMap())
                            stream.sendAndClose(
                                resumeStreamRequest {
                                    messageId = activeMessageId!!
                                    offset = charLen(current).toLong()
                                },
                            )
                            for (response in stream.responseChannel()) {
                                applyEvent(response.event, aiTempId)
                            }
                        }
                        break
                    } catch (e: CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        if (userAborted) throw e
                        resumes += 1
                        if (activeMessageId == null || resumes > MAX_RESUME) throw e
                        delay(500L * resumes)
                    }
                }
            } catch (e: CancellationException) {
                markAborted(aiTempId)
            } catch (e: Exception) {
                if (userAborted) {
                    markAborted(aiTempId)
                } else {
                    updateAi(aiTempId) {
                        it.copy(status = MessageStatusKind.ERROR, error = errorText(e))
                    }
                }
            } finally {
                streamJob = null
                activeMessageId = null
                _state.value = _state.value.copy(streaming = false)
            }
        }
    }

    override suspend fun abort() {
        userAborted = true
        val id = activeMessageId
        if (id != null) {
            try {
                clients.chat.abortMessage(
                    com.lemmaos.gen.lemma.v1.abortMessageRequest { messageId = id },
                    emptyMap(),
                )
            } catch (_: Exception) {
                // Persisting the abort is best-effort; the local stream is cut
                // either way.
            }
        }
        streamJob?.cancel()
    }

    private suspend fun applyEvent(event: com.lemmaos.gen.lemma.v1.ChatEvent, aiTempId: String) {
        val kind = event.kindCase
        when (kind) {
            com.lemmaos.gen.lemma.v1.ChatEvent.KindCase.STARTED ->
                activeMessageId = event.started.messageId
            com.lemmaos.gen.lemma.v1.ChatEvent.KindCase.DELTA ->
                updateAi(aiTempId) { it.copy(content = it.content + event.delta.content) }
            com.lemmaos.gen.lemma.v1.ChatEvent.KindCase.DONE ->
                updateAi(aiTempId) { it.copy(status = MessageStatusKind.DONE) }
            com.lemmaos.gen.lemma.v1.ChatEvent.KindCase.ABORTED ->
                updateAi(aiTempId) { it.copy(status = MessageStatusKind.ABORTED) }
            com.lemmaos.gen.lemma.v1.ChatEvent.KindCase.ERROR ->
                updateAi(aiTempId) { it.copy(status = MessageStatusKind.ERROR, error = event.error.message) }
            com.lemmaos.gen.lemma.v1.ChatEvent.KindCase.KIND_NOT_SET -> Unit
        }
    }

    private fun markAborted(aiTempId: String) {
        updateAi(aiTempId) { it.copy(status = MessageStatusKind.ABORTED) }
    }

    private fun updateAi(aiTempId: String, patch: (ChatMessage) -> ChatMessage) {
        _state.value = _state.value.copy(
            items = _state.value.items.map { if (it.id == aiTempId) patch(it) else it },
        )
    }
}

private fun com.lemmaos.gen.lemma.v1.Message.toChatMessage() = ChatMessage(
    id = id,
    role = role,
    content = content,
    status = when (status) {
        MessageStatus.MESSAGE_STATUS_STREAMING -> MessageStatusKind.STREAMING
        MessageStatus.MESSAGE_STATUS_ABORTED -> MessageStatusKind.ABORTED
        MessageStatus.MESSAGE_STATUS_ERROR -> MessageStatusKind.ERROR
        else -> MessageStatusKind.DONE
    },
    providerId = providerId,
    model = model,
)
