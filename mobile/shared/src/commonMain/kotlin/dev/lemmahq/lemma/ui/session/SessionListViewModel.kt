package dev.lemmahq.lemma.ui.session

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.lemmahq.lemma.client.ClientSession
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.i18n.errorText
import dev.lemmahq.lemma.ui.agent.AgentViewModel
import dev.lemmahq.lemma.ui.agent.SessionTurn
import dev.lemmahq.lemma.ui.agent.TurnState
import kotlinx.coroutines.launch

/**
 * Runs the session list: loads, creates, renames, deletes, and opens sessions in [agent], whose
 * failures show there. It marks the sessions whose turn runs, which each load takes from the
 * service and [agent]'s turns update in between, and, until the session is opened, the ones whose
 * last turn failed or finished while another session was open.
 */
internal class SessionListViewModel(
    private val client: LemmaClient,
    private val agent: AgentViewModel,
) : ViewModel() {
    private var running by mutableStateOf(emptySet<String>())
    private var finished by mutableStateOf(emptySet<String>())
    private var failed by mutableStateOf(emptySet<String>())

    var sessions by mutableStateOf<List<ClientSession>>(emptyList())
        private set

    /** The listed session that is open; null when none is open or the list lacks it. */
    val currentSession: ClientSession?
        get() = agent.openSession?.let { open -> sessions.find { it.id == open.id } }

    init {
        refreshSessions()
        viewModelScope.launch { agent.turns.collect(::track) }
    }

    fun refreshSessions() {
        viewModelScope.launch {
            try {
                val loaded = client.listSessions()
                sessions = loaded
                running = loaded.filter { it.activeMessageId != null }.map { it.id }.toSet()
            } catch (e: ServiceException) {
                agent.showError(errorText(e.failure))
            }
        }
    }

    fun markerOf(session: ClientSession): SessionMarker? =
        when (session.id) {
            in running -> SessionMarker.Running
            in failed -> SessionMarker.Failed
            in finished -> SessionMarker.Finished
            else -> null
        }

    /** Opens [session] in [agent] and clears its finished and failed markers. */
    fun selectSession(session: ClientSession) {
        finished -= session.id
        failed -= session.id
        agent.selectSession(session)
    }

    /** Creates a session and lists it first. */
    suspend fun createSession(): ClientSession =
        client.createSession().also { sessions = listOf(it) + sessions }

    /** Renames [session] to the trimmed [title]; a blank or unchanged title keeps the name. */
    fun renameSession(session: ClientSession, title: String) {
        val trimmed = title.trim()
        if (trimmed.isEmpty() || trimmed == session.title) return
        viewModelScope.launch {
            try {
                val renamed = client.renameSession(session.id, trimmed)
                sessions = sessions.map { if (it.id == renamed.id) renamed else it }
            } catch (e: ServiceException) {
                agent.showError(errorText(e.failure))
            }
        }
    }

    /** Deletes [session], and closes it when it is open. */
    fun deleteSession(session: ClientSession) {
        viewModelScope.launch {
            try {
                client.deleteSession(session.id)
                sessions = sessions.filter { it.id != session.id }
                running -= session.id
                finished -= session.id
                failed -= session.id
                agent.closeSession(session.id)
            } catch (e: ServiceException) {
                agent.showError(errorText(e.failure))
            }
        }
    }

    private fun track(turn: SessionTurn) {
        val id = turn.sessionId
        running = if (turn.state == TurnState.Running) running + id else running - id
        when (turn.state) {
            TurnState.Running -> {
                finished -= id
                failed -= id
            }
            TurnState.Done -> {
                failed -= id
                if (agent.openSession?.id != id) finished += id
            }
            TurnState.Failed -> {
                failed += id
                finished -= id
            }
            TurnState.Aborted -> Unit
        }
    }
}
