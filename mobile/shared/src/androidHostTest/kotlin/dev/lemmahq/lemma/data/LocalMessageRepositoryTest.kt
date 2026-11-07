package dev.lemmahq.lemma.data

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import dev.lemmahq.lemma.client.ClientMessage
import dev.lemmahq.lemma.client.ClientToolCall
import dev.lemmahq.lemma.client.ClientToolResult
import dev.lemmahq.lemma.client.MessageStatus
import dev.lemmahq.lemma.db.LemmaDatabase
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.coroutines.runBlocking

class LocalMessageRepositoryTest {

    private val repository =
        LocalMessageRepository(
            LemmaDatabase(
                JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY).also {
                    LemmaDatabase.Schema.create(it)
                }
            )
        )
    private val question = ClientMessage("q1", "user", "Weather?")
    private val toolStep =
        ClientMessage(
            id = "a1",
            role = "assistant",
            content = "",
            thinking = "Need data",
            status = MessageStatus.Error,
            error = "upstream closed",
            providerId = "openai",
            model = "gpt-4o",
            toolCalls = listOf(ClientToolCall("c1", "bash", "{}", startedAt = 1, finishedAt = 2)),
            thinkingStartedAt = 0,
            thinkingFinishedAt = 1,
        )
    private val result =
        ClientMessage("t1", "tool", "Fri", toolResult = ClientToolResult("c1", isError = false))

    @Test
    fun aSessionKeepsItsMessagesWholeInTheGivenOrder() = runBlocking {
        repository.replaceMessages("trip", listOf(question, toolStep, result))
        repository.replaceMessages("work", listOf(result))

        assertEquals(listOf(question, toolStep, result), repository.getMessages("trip"))
        assertEquals(listOf(result), repository.getMessages("work"))
    }

    @Test
    fun replacingASessionDropsItsEarlierMessages() = runBlocking {
        repository.replaceMessages("trip", listOf(question, toolStep, result))

        repository.replaceMessages("trip", listOf(toolStep))

        assertEquals(listOf(toolStep), repository.getMessages("trip"))
    }

    @Test
    fun deletingOneSessionOrAllLeavesNoMessagesBehind() = runBlocking {
        repository.replaceMessages("trip", listOf(question))
        repository.replaceMessages("work", listOf(result))

        repository.deleteMessages("trip")
        assertEquals(emptyList(), repository.getMessages("trip"))
        assertEquals(listOf(result), repository.getMessages("work"))

        repository.clear()
        assertEquals(emptyList(), repository.getMessages("work"))
    }
}
