package dev.lemmahq.lemma

import com.russhwolf.settings.MapSettings
import dev.lemmahq.lemma.client.ClientUser
import dev.lemmahq.lemma.client.Connection
import dev.lemmahq.lemma.client.FakeConnector
import dev.lemmahq.lemma.client.FakeLemmaClient
import dev.lemmahq.lemma.client.FakeLemmaClient.Call
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.client.sampleMessage
import dev.lemmahq.lemma.data.InMemoryTokenStore
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.i18n.UiText
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.setup_local_failed
import lemma.mobile.shared.generated.resources.setup_unreachable
import lemma.mobile.shared.generated.resources.setup_url_invalid

private const val SERVER_URL = "http://192.168.1.100:1025"

@OptIn(ExperimentalCoroutinesApi::class)
class AppViewModelTest {

    private val settings = SettingsRepository(MapSettings(), InMemoryTokenStore())
    private val client = FakeLemmaClient()
    private val connector = FakeConnector(client)
    private val dispatcher = StandardTestDispatcher()
    private val messageCache = testMessageCache(dispatcher)

    @BeforeTest
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @AfterTest
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun startsAtSetupWithoutAStoredConnection() = runTest {
        messageCache.replaceMessages("session-1", listOf(sampleMessage("message-1", "user")))
        val viewModel = AppViewModel(settings, connector, messageCache)
        advanceUntilIdle()

        assertEquals(AppState.Setup, viewModel.state)
        assertEquals(emptyList(), connector.opened)
        assertEquals(emptyList(), messageCache.getMessages("session-1"))
    }

    @Test
    fun opensTheStoredConnectionAndLoadsTheUser() = runTest {
        settings.setConnection(Connection.Local)
        settings.setTokens("access-1", "refresh-1")

        val viewModel = AppViewModel(settings, connector, messageCache)
        assertEquals(AppState.Opening, viewModel.state)
        advanceUntilIdle()

        assertEquals(AppState.Connected(Connection.Local, client, signedIn = true), viewModel.state)
        assertEquals(ClientUser("user-1", "ada"), viewModel.user)
        assertEquals(listOf(Call("me")), client.calls)
    }

    @Test
    fun aServerAddressNeedsAnHttpScheme() = runTest {
        val viewModel = AppViewModel(settings, connector, messageCache)

        viewModel.connectRemote("192.168.1.100:1025")
        advanceUntilIdle()

        assertEquals(UiText.Resource(Res.string.setup_url_invalid), viewModel.setupError)
        assertEquals(emptyList(), connector.opened)

        viewModel.connectRemote("https://lemma.example.com")
        advanceUntilIdle()

        assertNull(viewModel.setupError)
        assertEquals<List<Connection>>(
            listOf(Connection.Remote("https://lemma.example.com")),
            connector.opened,
        )
    }

    @Test
    fun accountActionsWaitForAConnection() = runTest {
        settings.setTokens("access-1", "refresh-1")
        val viewModel = AppViewModel(settings, connector, messageCache)

        viewModel.loadUser()
        viewModel.signOut()
        advanceUntilIdle()

        assertEquals(emptyList(), client.calls)
        assertNull(viewModel.user)
    }

    @Test
    fun theUserLoadsOncePerSignIn() = runTest {
        val reply = CompletableDeferred<ClientUser>()
        client.onMe = { reply.await() }
        settings.setConnection(Connection.Local)
        val viewModel = AppViewModel(settings, connector, messageCache)
        advanceUntilIdle()
        viewModel.loadUser()
        advanceUntilIdle()
        assertEquals(emptyList(), client.calls)

        settings.setTokens("access-1", "refresh-1")
        advanceUntilIdle()
        viewModel.loadUser()
        reply.complete(ClientUser("user-1", "ada"))
        advanceUntilIdle()
        viewModel.loadUser()
        advanceUntilIdle()

        assertEquals(ClientUser("user-1", "ada"), viewModel.user)
        assertEquals(listOf(Call("me")), client.calls)
    }

    @Test
    fun connectingChecksTheServerAndStoresItsAddress() = runTest {
        val viewModel = AppViewModel(settings, connector, messageCache)

        viewModel.connectRemote("  $SERVER_URL/ ")
        assertTrue(viewModel.connecting)
        advanceUntilIdle()

        val connection = Connection.Remote(SERVER_URL)
        assertFalse(viewModel.connecting)
        assertEquals(AppState.Connected(connection, client, signedIn = false), viewModel.state)
        assertEquals(connection, settings.getConnection())
        assertEquals(listOf(Call("getVersion")), client.calls)
    }

    @Test
    fun anUnreachableServerStaysInSetup() = runTest {
        client.onGetVersion = { throw ServiceException(ServiceFailure.Network) }
        val viewModel = AppViewModel(settings, connector, messageCache)

        viewModel.connectRemote(SERVER_URL)
        advanceUntilIdle()

        assertFalse(viewModel.connecting)
        assertEquals(
            UiText.Resource(Res.string.setup_unreachable, listOf(SERVER_URL)),
            viewModel.setupError,
        )
        assertEquals(AppState.Setup, viewModel.state)
        assertNull(settings.getConnection())
    }

    @Test
    fun runningLocallyOpensTheEngineAndStoresTheChoice() = runTest {
        val viewModel = AppViewModel(settings, connector, messageCache)

        viewModel.useLocal()
        advanceUntilIdle()

        assertEquals(
            AppState.Connected(Connection.Local, client, signedIn = false),
            viewModel.state,
        )
        assertEquals(Connection.Local, settings.getConnection())
    }

    @Test
    fun anEngineThatCannotStartStaysInSetup() = runTest {
        connector.onOpen = { throw ServiceException(ServiceFailure.Unspecified) }
        val viewModel = AppViewModel(settings, connector, messageCache)

        viewModel.useLocal()
        assertEquals(AppState.Opening, viewModel.state)
        advanceUntilIdle()

        assertEquals(UiText.Resource(Res.string.setup_local_failed), viewModel.setupError)
        assertEquals(AppState.Setup, viewModel.state)
        assertNull(settings.getConnection())
    }

    @Test
    fun signInLoadsTheUserAndSignOutClearsIt() = runTest {
        settings.setConnection(Connection.Local)
        val viewModel = AppViewModel(settings, connector, messageCache)
        advanceUntilIdle()

        settings.setTokens("access-1", "refresh-1")
        advanceUntilIdle()
        assertEquals(AppState.Connected(Connection.Local, client, signedIn = true), viewModel.state)
        assertEquals(ClientUser("user-1", "ada"), viewModel.user)

        messageCache.replaceMessages("session-1", listOf(sampleMessage("message-1", "user")))
        client.onSignOut = {
            settings.clearAuth()
            throw ServiceException(ServiceFailure.Network)
        }
        viewModel.signOut()
        advanceUntilIdle()
        assertEquals(Call("signOut"), client.calls.last())
        assertEquals(
            AppState.Connected(Connection.Local, client, signedIn = false),
            viewModel.state,
        )
        assertNull(viewModel.user)
        assertEquals(emptyList(), messageCache.getMessages("session-1"))
    }

    @Test
    fun aFailedUserLoadCanBeRetried() = runTest {
        settings.setConnection(Connection.Local)
        settings.setTokens("access-1", "refresh-1")
        var fail = true
        client.onMe = {
            if (fail) throw ServiceException(ServiceFailure.Network)
            ClientUser("user-2", "grace")
        }
        val viewModel = AppViewModel(settings, connector, messageCache)
        advanceUntilIdle()

        assertNull(viewModel.user)
        assertEquals(listOf(Call("me")), client.calls)

        fail = false
        viewModel.loadUser()
        advanceUntilIdle()

        assertEquals(ClientUser("user-2", "grace"), viewModel.user)
        assertEquals(listOf(Call("me"), Call("me")), client.calls)
    }

    @Test
    fun changingTheConnectionForgetsItTheTokensAndTheUser() = runTest {
        settings.setConnection(Connection.Remote(SERVER_URL))
        settings.setTokens("access-1", "refresh-1")
        val viewModel = AppViewModel(settings, connector, messageCache)
        advanceUntilIdle()

        viewModel.changeConnection()
        advanceUntilIdle()

        assertEquals(AppState.Setup, viewModel.state)
        assertNull(viewModel.user)
        assertNull(settings.getConnection())
        assertNull(settings.getAccessToken())
        assertNull(settings.getRefreshToken())
    }

    @Test
    fun changingTheConnectionBeforeSignInReturnsToSetup() = runTest {
        val viewModel = AppViewModel(settings, connector, messageCache)
        viewModel.useLocal()
        advanceUntilIdle()

        viewModel.changeConnection()

        assertEquals(AppState.Setup, viewModel.state)
        assertNull(settings.getConnection())
    }
}
