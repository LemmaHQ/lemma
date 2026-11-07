package dev.lemmahq.lemma.network

import com.russhwolf.settings.MapSettings
import dev.lemmahq.gen.lemma.v1.getVersionResponse
import dev.lemmahq.lemma.client.Connection
import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import dev.lemmahq.lemma.data.InMemoryTokenStore
import dev.lemmahq.lemma.data.SettingsRepository
import java.net.InetAddress
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okio.Buffer
import org.junit.Rule
import org.junit.rules.TemporaryFolder

class AndroidConnectorTest {

    @get:Rule val dataDir = TemporaryFolder()

    private val settings = SettingsRepository(MapSettings(), InMemoryTokenStore())
    private val server = MockWebServer()

    @AfterTest
    fun tearDown() {
        server.close()
    }

    @Test
    fun aRemoteConnectionCallsItsServer() = runTest {
        server.enqueue(
            MockResponse.Builder()
                .setHeader("Content-Type", "application/proto")
                .body(Buffer().write(getVersionResponse { version = "9.9.9" }.toByteArray()))
                .build()
        )
        server.start(InetAddress.getByName("127.0.0.1"), 0)
        val connector = AndroidConnector(dataDir.newFolder().path, settings)
        val serverUrl = server.url("/").toString().trimEnd('/')

        val version = connector.open(Connection.Remote(serverUrl)).getVersion()

        assertEquals("9.9.9", version)
        assertEquals("/lemma.v1.SystemService/GetVersion", server.takeRequest().url.encodedPath)
    }

    @Test
    fun theLocalEngineOpensOnceForEveryLocalClient() = runTest {
        val connector = AndroidConnector(dataDir.newFolder().path, settings)

        val first = connector.open(Connection.Local).getVersion()
        val second = connector.open(Connection.Local).getVersion()

        assertTrue(first.isNotBlank())
        assertEquals(first, second)
    }

    @Test
    fun anEngineThatCannotOpenFailsUnspecified() = runTest {
        val connector = AndroidConnector(dataDir.newFile().path, settings)

        val failure = assertFailsWith<ServiceException> { connector.open(Connection.Local) }

        assertEquals(ServiceFailure.Unspecified, failure.failure)
    }
}
