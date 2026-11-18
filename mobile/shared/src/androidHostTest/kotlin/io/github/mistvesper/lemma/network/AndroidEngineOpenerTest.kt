package io.github.mistvesper.lemma.network

import io.github.mistvesper.lemma.client.ServiceException
import io.github.mistvesper.lemma.client.ServiceFailure
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlinx.coroutines.test.runTest
import org.junit.Rule
import org.junit.rules.TemporaryFolder

class AndroidEngineOpenerTest {

    @get:Rule val dataDir = TemporaryFolder()

    @Test
    fun theEngineOpensOnceForEveryClient() = runTest {
        val engineOpener = AndroidEngineOpener(dataDir.newFolder().path)

        val first = engineOpener.open()
        val second = engineOpener.open()

        assertEquals(emptyList(), first.listSessions())
        assertEquals(emptyList(), second.listSessions())
    }

    @Test
    fun anEngineThatCannotOpenFailsUnspecified() = runTest {
        val engineOpener = AndroidEngineOpener(dataDir.newFile().path)

        val failure = assertFailsWith<ServiceException> { engineOpener.open() }

        assertEquals(ServiceFailure.Unspecified, failure.failure)
    }
}
