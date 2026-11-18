package io.github.mistvesper.lemma.ui.agent

import io.github.mistvesper.lemma.i18n.UiText
import io.github.mistvesper.lemma.ui.agent.MessageRole.Assistant
import io.github.mistvesper.lemma.ui.agent.MessageRole.Tool
import io.github.mistvesper.lemma.ui.agent.MessageRole.User
import kotlin.test.Test
import kotlin.test.assertEquals

class SessionTreeTest {

    private fun message(
        id: String,
        role: MessageRole,
        parentId: String? = null,
        content: String = "",
    ) =
        UiMessage(
            id,
            role,
            content,
            model = if (role == Assistant) "m1" else null,
            parentId = parentId,
        )

    @Test
    fun anEmptyTreeHasNoRowsAndNoPaths() {
        assertEquals(SessionTree(emptyList(), 0), buildSessionTree(emptyList(), null))
    }

    @Test
    fun anAssistantMessageCollapsesWithItsToolMessagesAndLaterSteps() {
        val messages =
            listOf(
                message("u1", User, content = "read a"),
                message("a1", Assistant, "u1"),
                message("t1", Tool, "a1", content = "A"),
                message("t2", Tool, "t1", content = "B"),
                message("a2", Assistant, "t2", content = "Done reading.").copy(label = "settled"),
            )

        assertEquals(
            SessionTree(
                listOf(
                    TreeRow("u1", true, UiText.Raw("read a"), null, 0, true, false),
                    TreeRow("a2", false, UiText.Raw("Done reading."), "settled", 0, true, true),
                ),
                pathCount = 1,
            ),
            buildSessionTree(messages, "a2"),
        )
    }

    @Test
    fun forksIndentTheirBranchesWithTheActivePathFirst() {
        val messages =
            listOf(
                message("u0", User, content = "alt root"),
                message("u1", User, content = "main root"),
                message("a1", Assistant, "u1", content = "reply 1"),
                message("t1", Tool, "a1", content = "tool out"),
                message("u2a", User, "t1", content = "branch off"),
                message("a2a", Assistant, "u2a").copy(error = UiText.Raw("failed")),
                message("u2c", User, "t1", content = "branch off 2"),
                message("u2b", User, "t1", content = "branch active"),
                message("a2b", Assistant, "u2b", content = "active leaf"),
            )

        val tree = buildSessionTree(messages, "a2b")

        assertEquals(4, tree.pathCount)
        assertEquals(
            listOf(
                listOf("u1", 1, true, false),
                listOf("t1", 1, true, false),
                listOf("u2b", 2, true, false),
                listOf("a2b", 2, true, true),
                listOf("u2a", 2, false, false),
                listOf("a2a", 2, false, true),
                listOf("u2c", 2, false, true),
                listOf("u0", 1, false, true),
            ),
            tree.rows.map { listOf(it.id, it.depth, it.onPath, it.isLeaf) },
        )
        assertEquals(UiText.Raw("reply 1"), tree.rows[1].title)
        assertEquals(UiText.Raw("failed"), tree.rows[5].title)
    }

    @Test
    fun aRunOfQuestionsAndRepliesStaysInOneColumnAndAnEmptyReplyShowsItsModel() {
        val messages =
            listOf(
                message("q1", User, content = "one"),
                message("a1", Assistant, "q1"),
                message("q2", User, "a1", content = "two"),
                message("a2", Assistant, "q2", content = "done"),
            )

        assertEquals(
            listOf(
                Triple("q1", UiText.Raw("one"), 0),
                Triple("a1", UiText.Raw("m1"), 0),
                Triple("q2", UiText.Raw("two"), 0),
                Triple("a2", UiText.Raw("done"), 0),
            ),
            buildSessionTree(messages, "a2").rows.map { Triple(it.id, it.title, it.depth) },
        )
    }

    @Test
    fun missingParentsMakeRootsAndARowWithoutTextOrModelHasAnEmptyTitle() {
        val messages =
            listOf(
                message("d1", User, "missing", content = "dangling"),
                message("a1", Assistant, "d1").copy(model = ""),
                message("t1", Tool, "a1"),
            )

        assertEquals(
            listOf("d1" to UiText.Raw("dangling"), "t1" to UiText.Raw("")),
            buildSessionTree(messages, "t1").rows.map { it.id to it.title },
        )
        assertEquals(
            listOf("t0" to UiText.Raw("")),
            buildSessionTree(listOf(message("t0", Tool, content = "orphan")), null).rows.map {
                it.id to it.title
            },
        )
    }
}
