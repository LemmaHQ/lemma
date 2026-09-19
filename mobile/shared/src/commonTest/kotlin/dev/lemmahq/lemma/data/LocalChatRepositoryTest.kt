package dev.lemmahq.lemma.data

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import dev.lemmahq.lemma.db.LemmaDatabase
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals

class LocalChatRepositoryTest {

    @Test
    fun testConversationAndMessageCaching() = runBlocking {
        val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
        LemmaDatabase.Schema.create(driver)
        val database = LemmaDatabase(driver)
        val repo = SqlDelightLocalChatRepository(database)

        assertEquals(0L, repo.getCursor())
        repo.setCursor(42L)
        assertEquals(42L, repo.getCursor())

        assertEquals(0, repo.getConversations().size)

        repo.saveConversation(
            id = "conv_1",
            title = "Test Conversation",
            status = 1,
            createdAt = 1000L,
            updatedAt = 2000L,
            syncSeq = 10L
        )

        val convs = repo.getConversations()
        assertEquals(1, convs.size)
        assertEquals("Test Conversation", convs.first().title)
        assertEquals(10L, convs.first().sync_seq)

        repo.saveMessage(
            id = "msg_1",
            conversationId = "conv_1",
            role = 1,
            content = "Hello offline world",
            status = 2,
            createdAt = 1000L,
            updatedAt = 1000L,
            syncSeq = 11L
        )

        val msgs = repo.getMessages("conv_1")
        assertEquals(1, msgs.size)
        assertEquals("Hello offline world", msgs.first().content)
        assertEquals(11L, msgs.first().sync_seq)

        repo.pruneConversationsNotIn(listOf("conv_other"))
        assertEquals(0, repo.getConversations().size)
        assertEquals(0, repo.getMessages("conv_1").size)
    }
}
