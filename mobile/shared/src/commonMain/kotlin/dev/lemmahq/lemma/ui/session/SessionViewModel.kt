package dev.lemmahq.lemma.ui.session

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.lemmahq.lemma.client.ClientProvider
import dev.lemmahq.lemma.client.ClientSession
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.data.LocalMessageRepository
import dev.lemmahq.lemma.data.ModelSelection
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.i18n.UiText
import dev.lemmahq.lemma.i18n.errorText
import kotlinx.coroutines.launch
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.error_model_required

private const val KEY_OPEN_SESSION = "open_session"

/**
 * Runs the session view: the account's sessions, the open session, and the model turns use. A new
 * session is created by its first turn. The open session survives the process through [savedState]
 * and reopens with the turn it was running.
 */
internal class SessionViewModel(
    private val client: LemmaClient,
    private val settings: SettingsRepository,
    private val messageCache: LocalMessageRepository,
    private val savedState: SavedStateHandle,
) : ViewModel() {
    private var startingTurn by mutableStateOf(false)

    var sessions by mutableStateOf<List<ClientSession>>(emptyList())
        private set

    /** The open session; null while a new session waits for its first turn. */
    var openSession by mutableStateOf<OpenSession?>(null)
        private set

    var input by mutableStateOf("")
        private set

    var providers by mutableStateOf<List<ClientProvider>>(emptyList())
        private set

    var selection by mutableStateOf<ModelSelection?>(null)
        private set

    var error by mutableStateOf<UiText?>(null)
        private set

    /** The text of the turn that failed last; [retry] puts it back into [input]. */
    var retryText by mutableStateOf<String?>(null)
        private set

    /** The listed session that is open; null when none is open or the list lacks it. */
    val currentSession: ClientSession?
        get() = openSession?.let { open -> sessions.find { it.id == open.id } }

    val messages: List<UiMessage>
        get() = openSession?.messages.orEmpty()

    val turnRunning: Boolean
        get() = startingTurn || openSession?.turnRunning == true

    /** Whether the service has started the running turn, so [stop] can abort it. */
    val stoppable: Boolean
        get() = openSession?.stoppable == true

    init {
        refreshSessions()
        savedState.get<String>(KEY_OPEN_SESSION)?.let(::open)
    }

    fun refreshSessions() {
        viewModelScope.launch {
            try {
                sessions = client.listSessions()
            } catch (e: ServiceException) {
                error = errorText(e.failure)
            }
        }
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

    /** Renames [session] to the trimmed [title]; a blank or unchanged title keeps the name. */
    fun renameSession(session: ClientSession, title: String) {
        val trimmed = title.trim()
        if (trimmed.isEmpty() || trimmed == session.title) return
        viewModelScope.launch {
            try {
                val renamed = client.renameSession(session.id, trimmed)
                sessions = sessions.map { if (it.id == renamed.id) renamed else it }
            } catch (e: ServiceException) {
                error = errorText(e.failure)
            }
        }
    }

    /** Deletes [session] with its cached messages, and closes it when it is open. */
    fun deleteSession(session: ClientSession) {
        viewModelScope.launch {
            try {
                client.deleteSession(session.id)
                sessions = sessions.filter { it.id != session.id }
                if (openSession?.id == session.id) close()
                messageCache.deleteMessages(session.id)
            } catch (e: ServiceException) {
                error = errorText(e.failure)
            }
        }
    }

    fun loadOlderMessages() {
        openSession?.loadOlder()
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
     * Sends [input] as a turn with the selected model, creating a session first when none is open;
     * does nothing while a turn runs.
     */
    fun send() {
        val text = input.trim()
        if (text.isEmpty() || turnRunning) return
        val model =
            selection
                ?: run {
                    error = UiText.Resource(Res.string.error_model_required)
                    return
                }
        input = ""
        dismissError()
        val onFailed = failureHandler(text)
        openSession?.let {
            it.send(text, model, onFailed)
            return
        }
        startingTurn = true
        viewModelScope.launch {
            try {
                val session = client.createSession()
                sessions = listOf(session) + sessions
                show(session.id).send(text, model, onFailed)
            } catch (e: ServiceException) {
                onFailed(errorText(e.failure))
            } finally {
                startingTurn = false
            }
        }
    }

    fun stop() {
        openSession?.stop()
    }

    /**
     * Sends again the user message that the reply [messageId] answers, with the selected model;
     * does nothing while a turn runs.
     */
    fun regenerate(messageId: String) {
        val session = openSession ?: return
        if (turnRunning) return
        val model = selection ?: return
        val question =
            session.messages
                .takeWhile { it.id != messageId }
                .lastOrNull { it.role == MessageRole.User } ?: return
        dismissError()
        session.send(question.content, model, failureHandler(question.content))
    }

    fun retry() {
        input = retryText.orEmpty()
        dismissError()
    }

    fun dismissError() {
        error = null
        retryText = null
    }

    private fun failureHandler(text: String): (UiText) -> Unit = { reason ->
        error = reason
        retryText = text
    }

    private fun open(sessionId: String) {
        show(sessionId).load { newestFirst ->
            selection =
                lastUsedSelection(newestFirst, providers)
                    ?: defaultSelection(providers, settings.getModelSelection())
        }
    }

    private fun show(sessionId: String): OpenSession {
        openSession?.close()
        savedState[KEY_OPEN_SESSION] = sessionId
        return OpenSession(sessionId, client, messageCache, viewModelScope) { error = it }
            .also { openSession = it }
    }

    private fun close() {
        openSession?.close()
        openSession = null
        savedState.remove<String>(KEY_OPEN_SESSION)
    }
}
