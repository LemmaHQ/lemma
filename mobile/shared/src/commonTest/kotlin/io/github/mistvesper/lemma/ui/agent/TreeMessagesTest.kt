package io.github.mistvesper.lemma.ui.agent

import io.github.mistvesper.lemma.client.MessageStatus
import io.github.mistvesper.lemma.ui.agent.MessageRole.Assistant
import io.github.mistvesper.lemma.ui.agent.MessageRole.User
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class TreeMessagesTest {

    private fun message(
        id: String,
        role: MessageRole,
        parentId: String? = null,
        status: MessageStatus = MessageStatus.Done,
    ) = UiMessage(id, role, id, status = status, parentId = parentId)

    private val q1 = message("q1", User)
    private val a1 = message("a1", Assistant, "q1")
    private val q2 = message("q2", User, "a1")
    private val a2 = message("a2", Assistant, "q2")
    private val q3 = message("q3", User, "a1")
    private val a3 = message("a3", Assistant, "q3")
    private val tree = listOf(q1, a1, q2, a2, q3, a3)

    @Test
    fun theActivePathWalksFromTheLeafToTheRootOldestFirst() {
        assertEquals(listOf(q1, a1, q2, a2), tree.activePath("a2"))
        assertEquals(listOf(q1, a1, q3, a3), tree.activePath("a3"))
    }

    @Test
    fun theActivePathStopsAtMissingMessagesAndCycles() {
        val orphan = message("orphan", Assistant, "missing")
        val c1 = message("c1", User, "c2")
        val c2 = message("c2", Assistant, "c1")
        val messages = listOf(q1, orphan, c1, c2)

        assertEquals(emptyList(), messages.activePath(null))
        assertEquals(emptyList(), messages.activePath("unknown"))
        assertEquals(listOf(orphan), messages.activePath("orphan"))
        assertEquals(listOf(c1, c2), messages.activePath("c2"))
    }

    @Test
    fun droppingDescendantsKeepsTheMessageAndOtherBranches() {
        assertEquals(listOf(q1, a1, q2, q3, a3), tree.withoutDescendantsOf("q2"))
        assertEquals(listOf(q1, a1), tree.withoutDescendantsOf("a1"))
    }

    @Test
    fun theRunningQuestionIsTheActiveMessageOnThePath() {
        val path = listOf(q1, a1, q2, a2)

        assertEquals("q2", path.runningQuestionId("q2"))
        assertNull(path.runningQuestionId("q3"))
    }

    @Test
    fun withoutAnActiveMessageTheLastQuestionRunsWhileAReplyAfterItStreams() {
        val streaming = message("a2", Assistant, "q2", MessageStatus.Streaming)

        assertEquals("q2", listOf(q1, a1, q2, streaming).runningQuestionId(null))
        assertNull(listOf(q1, a1, q2, a2).runningQuestionId(null))
        assertNull(listOf(streaming).runningQuestionId(null))
    }
}
