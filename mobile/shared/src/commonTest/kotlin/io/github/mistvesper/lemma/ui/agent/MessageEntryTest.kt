package io.github.mistvesper.lemma.ui.agent

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class MessageEntryTest {

    private val call = UiToolCall("c1", "bash", """{"command":"date"}""", running = false)
    private val orphan = UiMessage("a0", MessageRole.Assistant, "Hello")
    private val question = UiMessage("q1", MessageRole.User, "Day?")
    private val first = UiMessage("a1", MessageRole.Assistant, "", toolCalls = listOf(call))
    private val second = UiMessage("a2", MessageRole.Assistant, "Friday")
    private val followUp = UiMessage("q2", MessageRole.User, "Sure?")

    @Test
    fun eachQuestionIsFollowedByOneReplyOfTheMessagesThatAnswerIt() {
        val entries = listOf(orphan, question, first, second, followUp).toEntries()

        assertEquals(
            listOf(
                MessageEntry.Reply(null, listOf(orphan)),
                MessageEntry.Question(question),
                MessageEntry.Reply("q1", listOf(first, second)),
                MessageEntry.Question(followUp),
            ),
            entries,
        )
        assertEquals(listOf("a0", "q1", "q1:reply", "q2"), entries.map { it.key })
    }

    @Test
    fun aStepIsFoundAmongAllReplies() {
        val messages = listOf(question, first, second)

        assertEquals("date", messages.findStep("c1")?.argument)
        assertNull(messages.findStep("missing"))
    }
}
