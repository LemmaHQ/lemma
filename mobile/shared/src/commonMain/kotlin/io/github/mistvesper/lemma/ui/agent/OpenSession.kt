package io.github.mistvesper.lemma.ui.agent

import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import io.github.mistvesper.lemma.client.AgentStreamEvent
import io.github.mistvesper.lemma.client.ClientMessage
import io.github.mistvesper.lemma.client.ClientMessageTree
import io.github.mistvesper.lemma.client.LemmaClient
import io.github.mistvesper.lemma.client.MessageStatus
import io.github.mistvesper.lemma.client.ServiceException
import io.github.mistvesper.lemma.client.ServiceFailure
import io.github.mistvesper.lemma.client.activePath
import io.github.mistvesper.lemma.data.ModelSelection
import io.github.mistvesper.lemma.i18n.UiText
import io.github.mistvesper.lemma.i18n.errorText
import kotlin.time.Clock
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch

private const val MAX_RESUMES = 3
private const val RESUME_BACKOFF_MILLIS = 500L

/**
 * The open session [id]: its message tree, the path it shows, and its turn, run in a child of
 * [parent] until [close]. Loading fetches the message tree from the service, shows its active path,
 * then follows the running turn, whose streamed messages join the tree until the stored tree
 * replaces them once it ends. A turn whose stream breaks resumes up to three times and otherwise
 * fails its reply. [onTurn] receives [TurnState.Running] when a turn is followed and its end state
 * unless [close] stopped it first. Failures outside a turn go to [onError].
 */
internal class OpenSession(
    val id: String,
    private val client: LemmaClient,
    parent: CoroutineScope,
    private val onTurn: (TurnState) -> Unit,
    private val onError: (UiText) -> Unit,
) {
    private val scope = CoroutineScope(parent.coroutineContext + Job(parent.coroutineContext[Job]))
    private var loadJob: Job? = null
    private var turn by mutableStateOf<Turn?>(null)
    private var localIds = 0
    private var tree by mutableStateOf(emptyList<UiMessage>())
    private var leafId by mutableStateOf<String?>(null)
    private var rewind by mutableStateOf<Rewind?>(null)

    /** The shown path without the tool messages the view hides, oldest first. */
    val messages by derivedStateOf {
        tree.activePath(leafId).filter { it.role != MessageRole.Tool }
    }

    /** The rows of the whole message tree, the shown path first. */
    val sessionTree by derivedStateOf { buildSessionTree(tree, leafId) }

    /** Whether the shown path ends before a question that the next turn asks again. */
    val rewinding: Boolean
        get() = rewind != null

    val turnRunning: Boolean
        get() = turn != null

    /** When the running turn started, in epoch milliseconds; null while no turn runs. */
    val turnStartedAt: Long?
        get() = turn?.startedAt

    /** The event the running turn resumes its broken stream from; null while the stream flows. */
    var reconnectOffset by mutableStateOf<Long?>(null)
        private set

    /** Loads the message tree; [onLoaded] receives the active path, newest first. */
    fun load(onLoaded: (List<ClientMessage>) -> Unit) {
        loadJob = scope.launch {
            try {
                val loaded = client.listMessages(id)
                showTree(loaded)
                onLoaded(activePath(loaded).asReversed())
                if (turn == null) followRunningTurn(loaded.activeMessageId)
            } catch (e: ServiceException) {
                onError(errorText(e.failure))
            }
        }
    }

    /**
     * Sends [text] as a turn with [selection] once the messages have loaded, ending a rewind. A
     * [parentId] branches the turn under that message, or starts a new root branch when empty; null
     * continues from the shown path, or during a rewind branches under the rewound question's
     * parent. The caller sends only while no turn runs.
     */
    fun send(text: String, selection: ModelSelection, parentId: String? = null) {
        val requestParentId = parentId ?: rewind?.let { it.parentId.orEmpty() }
        rewind = null
        val turn = Turn(messageId = null, startedAt = now())
        this.turn = turn
        scope.launch {
            loadJob?.join()
            val (providerId, model) = selection
            val questionParentId =
                if (requestParentId == null) leafId else requestParentId.ifEmpty { null }
            val question = localMessage(MessageRole.User, text, null, questionParentId)
            val reply = localMessage(MessageRole.Assistant, "", selection, question.id)
            tree = tree + question + reply
            leafId = reply.id
            follow(
                turn,
                TurnEventReducer(providerId, model, question.id, reply.id),
                client.sendMessage(id, text, providerId, model, requestParentId),
            )
        }
    }

    fun stop() {
        val messageId = turn?.messageId ?: return
        call { client.abortMessage(messageId) }
    }

    /** Shows the path ending at [messageId] once the service has moved its leaf there. */
    fun switchLeaf(messageId: String) {
        call {
            client.setSessionLeaf(id, messageId)
            leafId = messageId
            rewind = null
        }
    }

    /**
     * Shows the path up to the parent of the question [questionId] and returns the question's text,
     * null for an unknown message. [draft] is the composer text that [cancelRewind] restores; a
     * rewind during a rewind keeps the first one's path and draft.
     */
    fun rewind(questionId: String, draft: String): String? {
        val question = tree.firstOrNull { it.id == questionId } ?: return null
        rewind =
            (rewind ?: Rewind(leafId, question.parentId, draft)).copy(parentId = question.parentId)
        leafId = question.parentId
        return question.content
    }

    /** Ends the rewind, shows the path it left, and returns its draft; null without a rewind. */
    fun cancelRewind(): String? {
        val current = rewind ?: return null
        rewind = null
        leafId = current.backupLeafId
        return current.previousDraft
    }

    /** Stores [label] as the bookmark on [messageId]; null clears it. */
    fun label(messageId: String, label: String?) {
        call {
            val saved = client.setMessageLabel(id, messageId, label)
            tree = tree.map { if (it.id == messageId) it.copy(label = saved.label) else it }
        }
    }

    /** Stops loading and following; a running turn continues on the service. */
    fun close() = scope.cancel()

    private fun call(block: suspend () -> Unit) {
        scope.launch {
            try {
                block()
            } catch (e: ServiceException) {
                onError(errorText(e.failure))
            }
        }
    }

    private fun showTree(loaded: ClientMessageTree) {
        tree = loaded.messages.map { it.toUiMessage() }.withToolResults()
        leafId = loaded.leafId
    }

    private fun followRunningTurn(activeMessageId: String?) {
        val path = tree.activePath(leafId)
        val userId = path.runningQuestionId(activeMessageId) ?: return
        val userIndex = path.indexOfFirst { it.id == userId }
        val running = path.drop(userIndex + 1).lastOrNull { it.role == MessageRole.Assistant }
        val selection = ModelSelection(running?.providerId.orEmpty(), running?.model.orEmpty())
        val reply = localMessage(MessageRole.Assistant, "", selection, userId)
        tree = tree.withoutDescendantsOf(userId) + reply
        leafId = reply.id
        val turn = Turn(messageId = userId, startedAt = path[userIndex].createdAt ?: now())
        this.turn = turn
        scope.launch {
            follow(
                turn,
                TurnEventReducer(selection.providerId, selection.model, userId, reply.id),
                client.resumeStream(userId, 0),
            )
        }
    }

    /**
     * Applies the events of [turn] from [stream] to the tree and shows the path to its reply; after
     * the stream breaks, resumes it from the events received so far. Once the turn has ended,
     * reloads the tree the service stored, unless the stream failed for good.
     */
    private suspend fun follow(
        turn: Turn,
        reducer: TurnEventReducer,
        stream: Flow<AgentStreamEvent>,
    ) {
        var events: Flow<AgentStreamEvent>? = stream
        var received = 0L
        var resumes = 0
        var state = TurnState.Done
        var reload = true
        onTurn(TurnState.Running)
        try {
            while (events != null) {
                events =
                    try {
                        events.collect { event ->
                            received++
                            reconnectOffset = null
                            when (event) {
                                is AgentStreamEvent.Started -> turn.messageId = event.messageId
                                is AgentStreamEvent.Aborted -> state = TurnState.Aborted
                                is AgentStreamEvent.Error -> state = TurnState.Failed
                                else -> Unit
                            }
                            tree = reducer.apply(tree, event)
                            leafId = reducer.replyId
                        }
                        null
                    } catch (e: ServiceException) {
                        val messageId = turn.messageId
                        resumes++
                        when {
                            e.failure == ServiceFailure.TurnNotRunning -> null
                            messageId == null || resumes > MAX_RESUMES -> {
                                tree = reducer.fail(tree, errorText(e.failure))
                                state = TurnState.Failed
                                reload = false
                                null
                            }
                            else -> {
                                reconnectOffset = received
                                delay(RESUME_BACKOFF_MILLIS * resumes)
                                client.resumeStream(messageId, received)
                            }
                        }
                    }
            }
            onTurn(state)
            if (reload) reloadTree()
        } finally {
            this.turn = null
            reconnectOffset = null
        }
    }

    private suspend fun reloadTree() {
        try {
            showTree(client.listMessages(id))
        } catch (e: ServiceException) {
            onError(errorText(e.failure))
        }
    }

    private fun localMessage(
        role: MessageRole,
        text: String,
        selection: ModelSelection?,
        parentId: String?,
    ) =
        UiMessage(
            id = "local-${localIds++}",
            role = role,
            content = text,
            status = if (role == MessageRole.User) MessageStatus.Done else MessageStatus.Streaming,
            providerId = selection?.providerId,
            model = selection?.model,
            parentId = parentId,
        )

    /**
     * A turn of this session started at [startedAt], known by its user message [messageId] once the
     * service started it.
     */
    private class Turn(var messageId: String?, val startedAt: Long)

    /**
     * A rewind that left the path ending at [backupLeafId] and the composer at [previousDraft]; the
     * next turn goes under [parentId], null for a new root branch.
     */
    private data class Rewind(
        val backupLeafId: String?,
        val parentId: String?,
        val previousDraft: String,
    )
}

private fun now() = Clock.System.now().toEpochMilliseconds()
