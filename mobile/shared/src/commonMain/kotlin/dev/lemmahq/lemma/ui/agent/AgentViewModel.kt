package dev.lemmahq.lemma.ui.agent

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.ClientSession
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.client.MessageStatus
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.data.ModelSelection
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.i18n.UiText
import dev.lemmahq.lemma.i18n.errorText
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.errors_model_required

private const val KEY_OPEN_SESSION = "open_session"

/**
 * Runs the open session and the model its turns use. A new session is created by its first turn.
 * The open session survives the process through [savedState] and reopens with the turn it was
 * running.
 */
internal class AgentViewModel(
    private val client: LemmaClient,
    private val settings: SettingsRepository,
    private val savedState: SavedStateHandle,
) : ViewModel() {
    private var startingTurn by mutableStateOf(false)
    private val _turns = MutableSharedFlow<SessionTurn>(extraBufferCapacity = Channel.UNLIMITED)

    /**
     * The turns of the sessions open here as they start and end; a turn whose session closes while
     * it runs reports no end.
     */
    val turns: SharedFlow<SessionTurn> = _turns.asSharedFlow()

    /** The open session; null while a new session waits for its first turn. */
    var openSession by mutableStateOf<OpenSession?>(null)
        private set

    var input by mutableStateOf("")
        private set

    var providers by mutableStateOf<List<ClientProvider>>(emptyList())
        private set

    var selection by mutableStateOf<ModelSelection?>(null)
        private set

    /** A failure outside a turn, shown until [dismissError]. */
    var error by mutableStateOf<UiText?>(null)
        private set

    val messages: List<UiMessage>
        get() = openSession?.messages.orEmpty()

    val turnRunning: Boolean
        get() = startingTurn || openSession?.turnRunning == true

    /** When the running turn started, in epoch milliseconds; null while no turn runs. */
    val turnStartedAt: Long?
        get() = openSession?.turnStartedAt

    /** The event the running turn resumes its broken stream from; null while the stream flows. */
    val reconnectOffset: Long?
        get() = openSession?.reconnectOffset

    /**
     * The failed reply that ends the shown path while no turn runs; [retry] asks its turn again.
     */
    val turnFailure: UiMessage?
        get() = messages.lastOrNull()?.takeIf { !turnRunning && it.status == MessageStatus.Error }

    /** The rows of the open session's message tree; null while no session is open. */
    val sessionTree: SessionTree?
        get() = openSession?.sessionTree

    /** Whether the shown path ends before a question that the next turn asks again. */
    val rewinding: Boolean
        get() = openSession?.rewinding == true

    init {
        savedState.get<String>(KEY_OPEN_SESSION)?.let(::open)
    }

    /** Reloads the providers; the selection stays while an enabled provider still offers it. */
    fun loadProviders() {
        viewModelScope.launch {
            try {
                val loaded = client.listProviders()
                providers = loaded
                selection =
                    selection?.takeIf { it.isOffered(loaded) }
                        ?: defaultSelection(loaded, settings.getModelSelection())
            } catch (e: ServiceException) {
                error = errorText(e.failure)
            }
        }
    }

    /** Closes the open session for a new one, which its first turn creates. */
    fun newSession() {
        close()
        selection = defaultSelection(providers, settings.getModelSelection())
    }

    /** Opens [session] and selects the model its newest reply used, else the default model. */
    fun selectSession(session: ClientSession) {
        if (session.id != openSession?.id) open(session.id)
    }

    /** Closes the open session when it is [sessionId]. */
    fun closeSession(sessionId: String) {
        if (openSession?.id == sessionId) close()
    }

    fun showError(error: UiText) {
        this.error = error
    }

    fun changeInput(value: String) {
        input = value
    }

    /** Selects [selection] for the next turns and stores it as the default model. */
    fun selectModel(selection: ModelSelection) {
        this.selection = selection
        settings.setModelSelection(selection)
    }

    /**
     * Sends [input] as a turn with the selected model, opening a session from [createSession] first
     * when none is open; [input] stays when that fails. During a rewind the turn branches beside
     * the rewound question. Does nothing while a turn runs.
     */
    fun send(createSession: suspend () -> ClientSession) {
        val text = input.trim()
        if (text.isEmpty() || turnRunning) return
        val model =
            selection
                ?: run {
                    error = UiText.Resource(Res.string.errors_model_required)
                    return
                }
        openSession?.let {
            input = ""
            it.send(text, model)
            return
        }
        startingTurn = true
        viewModelScope.launch {
            try {
                val session = createSession()
                input = ""
                show(session.id).send(text, model)
            } catch (e: ServiceException) {
                error = errorText(e.failure)
            } finally {
                startingTurn = false
            }
        }
    }

    fun stop() {
        openSession?.stop()
    }

    /**
     * Asks again the user message that the reply [messageId] answers, with the selected model, as a
     * sibling of that message, so the new reply opens a branch the session then shows; does nothing
     * while a turn runs.
     */
    fun regenerate(messageId: String) {
        val session = openSession ?: return
        if (turnRunning) return
        val model = selection ?: return
        val question =
            session.messages
                .takeWhile { it.id != messageId }
                .lastOrNull { it.role == MessageRole.User } ?: return
        session.send(question.content, model, parentId = question.parentId.orEmpty())
    }

    /** Asks the turn of [turnFailure] again, as [regenerate] does for its reply. */
    fun retry() {
        turnFailure?.let { regenerate(it.id) }
    }

    /** Shows the path ending at the reply [messageId]; does nothing while a turn runs. */
    fun switchLeaf(messageId: String) {
        if (!turnRunning) openSession?.switchLeaf(messageId)
    }

    /**
     * Shows the path before the question [questionId] and puts its text in the composer, so the
     * next turn asks it again on a new branch; does nothing while a turn runs.
     */
    fun rewind(questionId: String) {
        if (turnRunning) return
        openSession?.rewind(questionId, input)?.let { input = it }
    }

    /**
     * Ends the rewind and restores the path and the composer text it replaced, as leaving the
     * session does.
     */
    fun cancelRewind() {
        openSession?.cancelRewind()?.let { input = it }
    }

    /** Sets [label], trimmed, as the bookmark on [messageId]; a blank label clears it. */
    fun labelMessage(messageId: String, label: String) {
        openSession?.label(messageId, label.trim().ifEmpty { null })
    }

    fun dismissError() {
        error = null
    }

    private fun open(sessionId: String) {
        show(sessionId).load { newestFirst ->
            selection =
                lastUsedSelection(newestFirst, providers)
                    ?: defaultSelection(providers, settings.getModelSelection())
        }
    }

    private fun show(sessionId: String): OpenSession {
        cancelRewind()
        openSession?.close()
        savedState[KEY_OPEN_SESSION] = sessionId
        return OpenSession(
                sessionId,
                client,
                viewModelScope,
                onTurn = { _turns.tryEmit(SessionTurn(sessionId, it)) },
                onError = { error = it },
            )
            .also { openSession = it }
    }

    private fun close() {
        cancelRewind()
        openSession?.close()
        openSession = null
        savedState.remove<String>(KEY_OPEN_SESSION)
    }
}
