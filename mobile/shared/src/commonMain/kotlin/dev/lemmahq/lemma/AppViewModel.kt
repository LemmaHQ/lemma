package dev.lemmahq.lemma

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.lemmahq.lemma.client.ClientUser
import dev.lemmahq.lemma.client.Connection
import dev.lemmahq.lemma.client.Connector
import dev.lemmahq.lemma.client.LemmaClient
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.data.LocalMessageRepository
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.i18n.UiText
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.setup_local_failed
import lemma.mobile.shared.generated.resources.setup_unreachable
import lemma.mobile.shared.generated.resources.setup_url_invalid

/**
 * Opens the stored connection and tracks sign-in and the current user. Signing out clears [user]
 * and [messageCache]; [state] decides which part of the app shows.
 */
class AppViewModel(
    private val settings: SettingsRepository,
    private val connector: Connector,
    private val messageCache: LocalMessageRepository,
) : ViewModel() {
    private var opening by mutableStateOf(false)
    private var connected by mutableStateOf<Pair<Connection, LemmaClient>?>(null)
    private var signedIn by mutableStateOf(settings.signedIn.value)
    private var userLoad: Job? = null

    /** Whether a server check or an engine start is running from the setup screen. */
    var connecting by mutableStateOf(false)
        private set

    var setupError by mutableStateOf<UiText?>(null)
        private set

    var user by mutableStateOf<ClientUser?>(null)
        private set

    val localAvailable: Boolean
        get() = connector.localAvailable

    val state: AppState
        get() {
            val (connection, client) =
                connected ?: return if (opening) AppState.Opening else AppState.Setup
            return AppState.Connected(connection, client, signedIn)
        }

    init {
        viewModelScope.launch {
            settings.signedIn.collect {
                signedIn = it
                if (it) {
                    loadUser()
                } else {
                    userLoad?.cancel()
                    user = null
                    messageCache.clear()
                }
            }
        }
        settings.getConnection()?.let { open(it) }
    }

    /** Connects to the server at [input] once a Lemma server answers there. */
    fun connectRemote(input: String) {
        val serverUrl = input.trim().trimEnd('/')
        if (!serverUrl.startsWith("http://") && !serverUrl.startsWith("https://")) {
            setupError = UiText.Resource(Res.string.setup_url_invalid)
            return
        }
        connecting = true
        setupError = null
        viewModelScope.launch {
            val connection = Connection.Remote(serverUrl)
            try {
                val client = connector.open(connection)
                client.getVersion()
                settings.setConnection(connection)
                connected = connection to client
                loadUser()
            } catch (_: ServiceException) {
                setupError = UiText.Resource(Res.string.setup_unreachable, listOf(serverUrl))
            } finally {
                connecting = false
            }
        }
    }

    fun useLocal() {
        open(Connection.Local)
    }

    /** Forgets the connection and the token pair and returns to setup. */
    fun changeConnection() {
        settings.clearAuth()
        settings.setConnection(null)
        connected = null
        userLoad?.cancel()
        user = null
    }

    /** Signs out at once; the service revokes the refresh token unless it cannot be reached. */
    fun signOut() {
        val client = (connected ?: return).second
        viewModelScope.launch {
            try {
                client.signOut()
            } catch (_: ServiceException) {}
        }
    }

    fun loadUser() {
        val client = (connected ?: return).second
        if (!signedIn || user != null || userLoad?.isActive == true) return
        userLoad = viewModelScope.launch {
            user =
                try {
                    client.me()
                } catch (_: ServiceException) {
                    null
                }
        }
    }

    private fun open(connection: Connection) {
        opening = true
        setupError = null
        viewModelScope.launch {
            try {
                connected = connection to connector.open(connection)
                settings.setConnection(connection)
                loadUser()
            } catch (_: ServiceException) {
                setupError = UiText.Resource(Res.string.setup_local_failed)
            } finally {
                opening = false
            }
        }
    }
}
