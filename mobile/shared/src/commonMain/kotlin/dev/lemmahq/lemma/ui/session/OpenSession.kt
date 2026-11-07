package dev.lemmahq.lemma.ui.session

import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.ClientMessage
import dev.lemmahq.lemma.client.ClientMessagePage
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.client.MessageStatus
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.data.LocalMessageRepository
import dev.lemmahq.lemma.data.ModelSelection
import dev.lemmahq.lemma.i18n.UiText
import dev.lemmahq.lemma.i18n.errorText
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch

private const val MESSAGE_PAGE_SIZE = 50
private const val MAX_RESUMES = 3
private const val RESUME_BACKOFF_MILLIS = 500L

/**
 * The open session [id]: its messages and its turn, run in a child of [parent] until [close].
 * Loading shows the cached messages until the service returns the newest page, then follows the
 * turn that page shows running. A turn whose stream breaks resumes up to three times. Failures go
 * to [onError].
 */
internal class OpenSession(
    val id: String,
    private val client: LemmaClient,
    private val messageCache: LocalMessageRepository,
    parent: CoroutineScope,
    private val onError: (UiText) -> Unit,
) {
    private val scope = CoroutineScope(parent.coroutineContext + Job(parent.coroutineContext[Job]))
    private var loadJob: Job? = null
    private var shownPages = emptyList<ClientMessage>()
    private var turn by mutableStateOf<Turn?>(null)
    private var localIds = 0

    /** The messages with the tool messages the view hides, oldest first. */
    var items by mutableStateOf(emptyList<UiMessage>())
        private set

    val messages by derivedStateOf { items.filter { it.role != MessageRole.Tool } }

    var hasOlderMessages by mutableStateOf(false)
        private set

    var loadingOlderMessages by mutableStateOf(false)
        private set

    val turnRunning: Boolean
        get() = turn != null

    /** Whether the service has started the running turn, so [stop] can abort it. */
    val stoppable: Boolean
        get() = turn?.messageId != null

    /** Loads the messages; [onNewestPage] receives the newest page, newest first. */
    fun load(onNewestPage: (List<ClientMessage>) -> Unit) {
        loadJob = scope.launch {
            items = messageCache.getMessages(id).toUiMessages()
            try {
                val page = client.listMessages(id, null, MESSAGE_PAGE_SIZE)
                showNewestPage(page)
                onNewestPage(page.messages)
                if (turn == null) followRunningTurn()
            } catch (e: ServiceException) {
                onError(errorText(e.failure))
            }
        }
    }

    /** Prepends the page before the oldest loaded message while the service has older ones. */
    fun loadOlder() {
        val beforeId = (shownPages.firstOrNull() ?: return).id
        if (!hasOlderMessages || loadingOlderMessages) return
        loadingOlderMessages = true
        scope.launch {
            try {
                val page = client.listMessages(id, beforeId, MESSAGE_PAGE_SIZE)
                val older = page.messages.asReversed()
                items = (older.toUiMessages() + items).withToolResults()
                hasOlderMessages = page.hasMore
                cache(older + shownPages)
            } catch (e: ServiceException) {
                onError(errorText(e.failure))
            } finally {
                loadingOlderMessages = false
            }
        }
    }

    /**
     * Sends [text] as a turn with [selection] once the messages have loaded; [onFailed] receives
     * the reason a turn ends without its stream. The caller sends only while no turn runs.
     */
    fun send(text: String, selection: ModelSelection, onFailed: (UiText) -> Unit) {
        val turn = Turn(messageId = null)
        this.turn = turn
        scope.launch {
            loadJob?.join()
            val reply = localMessage(MessageRole.Assistant, "", selection)
            items = items + localMessage(MessageRole.User, text, null) + reply
            follow(
                turn,
                TurnReducer(selection.providerId, selection.model, reply.id),
                client.sendMessage(id, text, selection.providerId, selection.model),
                onFailed,
            )
        }
    }

    fun stop() {
        val messageId = turn?.messageId ?: return
        scope.launch {
            try {
                client.abortMessage(messageId)
            } catch (e: ServiceException) {
                onError(errorText(e.failure))
            }
        }
    }

    /** Stops loading and following; a running turn continues on the service. */
    fun close() {
        scope.cancel()
    }

    private suspend fun showNewestPage(page: ClientMessagePage) {
        val newest = page.messages.asReversed()
        items = newest.toUiMessages()
        hasOlderMessages = page.hasMore
        cache(newest)
    }

    private suspend fun cache(pages: List<ClientMessage>) {
        shownPages = pages
        messageCache.replaceMessages(id, pages)
    }

    private fun followRunningTurn() {
        val userIndex = shownPages.indexOfLast { it.role == "user" }
        if (userIndex < 0) return
        val running =
            shownPages.drop(userIndex + 1).lastOrNull { it.status == MessageStatus.Streaming }
                ?: return
        val selection = ModelSelection(running.providerId.orEmpty(), running.model.orEmpty())
        val reply = localMessage(MessageRole.Assistant, "", selection)
        val userId = shownPages[userIndex].id
        items = items.take(items.indexOfFirst { it.id == userId } + 1) + reply
        val turn = Turn(messageId = userId)
        this.turn = turn
        scope.launch {
            follow(
                turn,
                TurnReducer(selection.providerId, selection.model, reply.id),
                client.resumeStream(userId, 0),
                onError,
            )
        }
    }

    /**
     * Applies the events of [turn] from [stream]; after the stream breaks, resumes it from the
     * events received so far, and once the turn has ended, shows the newest page instead.
     */
    private suspend fun follow(
        turn: Turn,
        reducer: TurnReducer,
        stream: Flow<AgentStreamEvent>,
        onFailed: (UiText) -> Unit,
    ) {
        var events: Flow<AgentStreamEvent>? = stream
        var received = 0L
        var resumes = 0
        try {
            while (events != null) {
                events =
                    try {
                        events.collect { event ->
                            received++
                            if (event is AgentStreamEvent.Started) turn.messageId = event.messageId
                            items = reducer.apply(items, event)
                        }
                        null
                    } catch (e: ServiceException) {
                        val messageId = turn.messageId
                        resumes++
                        when {
                            e.failure == ServiceFailure.TurnNotRunning -> {
                                reloadNewestPage()
                                null
                            }
                            messageId == null || resumes > MAX_RESUMES -> {
                                val reason = errorText(e.failure)
                                items = reducer.fail(items, reason)
                                onFailed(reason)
                                null
                            }
                            else -> {
                                delay(RESUME_BACKOFF_MILLIS * resumes)
                                client.resumeStream(messageId, received)
                            }
                        }
                    }
            }
        } finally {
            this.turn = null
        }
    }

    private suspend fun reloadNewestPage() {
        try {
            showNewestPage(client.listMessages(id, null, MESSAGE_PAGE_SIZE))
        } catch (e: ServiceException) {
            onError(errorText(e.failure))
        }
    }

    private fun localMessage(role: MessageRole, text: String, selection: ModelSelection?) =
        UiMessage(
            id = "local-${localIds++}",
            role = role,
            content = text,
            status = if (role == MessageRole.User) MessageStatus.Done else MessageStatus.Streaming,
            providerId = selection?.providerId,
            model = selection?.model,
        )

    /**
     * A turn of this session, known by its user message [messageId] once the service started it.
     */
    private class Turn(messageId: String?) {
        var messageId by mutableStateOf(messageId)
    }
}

private fun List<ClientMessage>.toUiMessages(): List<UiMessage> = map {
    it.toUiMessage()
}
    .withToolResults()
