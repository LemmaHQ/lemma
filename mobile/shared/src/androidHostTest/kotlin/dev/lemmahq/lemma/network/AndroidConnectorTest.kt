package dev.lemmahq.lemma.network

import dev.lemmahq.lemma.client.ServiceException
import dev.lemmahq.lemma.client.ServiceFailure
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlinx.coroutines.test.runTest
import org.junit.Rule
import org.junit.rules.TemporaryFolder

class AndroidConnectorTest {

    @get:Rule val dataDir = TemporaryFolder()

    @Test
    fun theLocalEngineOpensOnceForEveryClient() = runTest {
        val connector = AndroidConnector(dataDir.newFolder().path)

        val first = connector.open()
        val second = connector.open()

        assertEquals(emptyList(), first.listSessions())
        assertEquals(emptyList(), second.listSessions())
    }

    @Test
    fun anEngineThatCannotOpenFailsUnspecified() = runTest {
        val connector = AndroidConnector(dataDir.newFile().path)

        val failure = assertFailsWith<ServiceException> { connector.open() }

        assertEquals(ServiceFailure.Unspecified, failure.failure)
    }
}
