package dev.lemmahq.lemma.data

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import dev.lemmahq.lemma.db.LemmaDatabase
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.coroutines.runBlocking

class LocalChatRepositoryTest {

    @Test
    fun savedMessagesListPerConversationInCreationOrder() = runBlocking {
        val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
        LemmaDatabase.Schema.create(driver)
        val repo = LocalChatRepository(LemmaDatabase(driver))

        repo.saveMessage("msg_2", "conv_1", 2, "second", 2, 2000L, 2000L)
        repo.saveMessage("msg_1", "conv_1", 1, "first", 2, 1000L, 1000L)
        repo.saveMessage("msg_3", "conv_2", 1, "other", 2, 500L, 500L)
        repo.saveMessage("msg_1", "conv_1", 1, "first, edited", 2, 1000L, 1500L)

        val msgs = repo.getMessages("conv_1")
        assertEquals(listOf("msg_1", "msg_2"), msgs.map { it.id })
        assertEquals("first, edited", msgs.first().content)
    }
}
