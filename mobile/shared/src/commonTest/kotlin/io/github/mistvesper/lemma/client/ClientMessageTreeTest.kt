package io.github.mistvesper.lemma.client

import kotlin.test.Test
import kotlin.test.assertEquals

class ClientMessageTreeTest {

    @Test
    fun activePathWalksFromLeafToRootOldestFirstAcrossBranches() {
        val q1 = sampleMessage("q1", "user")
        val a1 = sampleMessage("a1", "assistant", parentId = "q1")
        val q2 = sampleMessage("q2", "user", parentId = "a1")
        val a2 = sampleMessage("a2", "assistant", parentId = "q2")
        val q3 = sampleMessage("q3", "user", parentId = "a1")
        val a3 = sampleMessage("a3", "assistant", parentId = "q3")
        val messages = listOf(q1, a1, q2, a2, q3, a3)

        assertEquals(listOf(q1, a1, q2, a2), activePath(ClientMessageTree(messages, leafId = "a2")))
        assertEquals(listOf(q1, a1, q3, a3), activePath(ClientMessageTree(messages, leafId = "a3")))
    }

    @Test
    fun activePathHandlesMissingLeavesBrokenLinksAndCyclesGracefully() {
        val q1 = sampleMessage("q1", "user")
        val orphan = sampleMessage("orphan", "assistant", parentId = "missing")
        val c1 = sampleMessage("c1", "user", parentId = "c2")
        val c2 = sampleMessage("c2", "assistant", parentId = "c1")
        val messages = listOf(q1, orphan, c1, c2)

        assertEquals(emptyList(), activePath(ClientMessageTree(messages, leafId = null)))
        assertEquals(emptyList(), activePath(ClientMessageTree(messages, leafId = "unknown")))
        assertEquals(listOf(orphan), activePath(ClientMessageTree(messages, leafId = "orphan")))
        assertEquals(listOf(c1, c2), activePath(ClientMessageTree(messages, leafId = "c2")))
    }
}
