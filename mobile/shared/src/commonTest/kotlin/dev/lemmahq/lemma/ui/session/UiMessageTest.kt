package dev.lemmahq.lemma.ui.session

import dev.lemmahq.lemma.client.ClientMessage
import dev.lemmahq.lemma.client.ClientToolCall
import dev.lemmahq.lemma.client.ClientToolResult
import dev.lemmahq.lemma.client.MessageStatus
import dev.lemmahq.lemma.i18n.UiText
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class UiMessageTest {

    @Test
    fun aFailedMessageShowsItsErrorAsReceived() {
        val failed =
            ClientMessage("a1", "assistant", "", status = MessageStatus.Error, error = "boom")

        assertEquals(UiText.Raw("boom"), failed.toUiMessage().error)
        assertNull(failed.copy(error = "").toUiMessage().error)
    }

    @Test
    fun toolResultsJoinTheCallsTheyAnswer() {
        val reply =
            ClientMessage(
                "a1",
                "assistant",
                "",
                toolCalls =
                    listOf(
                        ClientToolCall("c1", "bash", "{}"),
                        ClientToolCall("c2", "read", "{}"),
                    ),
            )
        val result =
            ClientMessage("t1", "tool", "denied", toolResult = ClientToolResult("c1", true))

        val calls =
            listOf(reply, result).map { it.toUiMessage() }.withToolResults().first().toolCalls

        assertEquals(
            listOf(
                UiToolCall("c1", "bash", "{}", running = false, output = "denied", isError = true),
                UiToolCall("c2", "read", "{}", running = false),
            ),
            calls,
        )
    }
}
