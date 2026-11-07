package dev.lemmahq.lemma.ui.session

import dev.lemmahq.lemma.client.AgentStreamEvent
import dev.lemmahq.lemma.client.MessageStatus
import dev.lemmahq.lemma.i18n.UiText
import kotlin.test.Test
import kotlin.test.assertEquals

class TurnReducerTest {

    private val question = UiMessage("q1", MessageRole.User, "Weather?")
    private val placeholder =
        UiMessage(
            "local-1",
            MessageRole.Assistant,
            "",
            status = MessageStatus.Streaming,
            providerId = "openai",
            model = "gpt-4o",
        )

    private fun reduce(vararg events: AgentStreamEvent): List<UiMessage> {
        val reducer = TurnReducer("openai", "gpt-4o", placeholder.id)
        return events.fold(listOf(question, placeholder)) { messages, event ->
            reducer.apply(messages, event)
        }
    }

    @Test
    fun theFirstStepTakesOverThePlaceholderAndEachLaterStepSettlesTheOneBefore() {
        val messages =
            reduce(
                AgentStreamEvent.Started("q1"),
                AgentStreamEvent.TurnStarted("a1"),
                AgentStreamEvent.TextDelta("Let me check."),
                AgentStreamEvent.TurnStarted("a2"),
                AgentStreamEvent.TextDelta("Sunny"),
                AgentStreamEvent.Done(),
            )

        assertEquals(
            listOf(
                question,
                placeholder.copy(id = "a1", content = "Let me check.", status = MessageStatus.Done),
                placeholder.copy(id = "a2", content = "Sunny", status = MessageStatus.Done),
            ),
            messages,
        )
    }

    @Test
    fun thinkingEndsAtTheFirstEventAfterIt() {
        val messages =
            reduce(
                AgentStreamEvent.TurnStarted("a1"),
                AgentStreamEvent.ThinkingDelta("Hmm", occurredAt = 1_000),
                AgentStreamEvent.ThinkingDelta(", rain?", occurredAt = 2_000),
                AgentStreamEvent.TextDelta("Sunny", occurredAt = 3_500),
                AgentStreamEvent.Done(occurredAt = 4_000),
            )

        val reply = messages.last()
        assertEquals("Hmm, rain?", reply.thinking)
        assertEquals(1_000L, reply.thinkingStartedAt)
        assertEquals(3_500L, reply.thinkingFinishedAt)
    }

    @Test
    fun aStepWithoutThinkingRecordsNoThinkingInterval() {
        val reply =
            reduce(
                    AgentStreamEvent.TextDelta("Sunny", occurredAt = 1_000),
                    AgentStreamEvent.Done(2_000),
                )
                .last()

        assertEquals(null, reply.thinkingStartedAt)
        assertEquals(null, reply.thinkingFinishedAt)
    }

    @Test
    fun toolCallsRunUntilTheirResultArrives() {
        val running =
            reduce(
                AgentStreamEvent.TurnStarted("a1"),
                AgentStreamEvent.ThinkingDelta("Need data", occurredAt = 500),
                AgentStreamEvent.ToolCallStarted("c1", "bash", """{"cmd":"date"}""", 1_000),
                AgentStreamEvent.ToolCallStarted("c2", "read_file", """{"path":"a"}""", 1_100),
                AgentStreamEvent.ToolCallFinished("c2", "no such file", isError = true, 1_400),
            )

        assertEquals(1_000L, running.last().thinkingFinishedAt)
        assertEquals(
            listOf(
                UiToolCall("c1", "bash", """{"cmd":"date"}""", running = true, startedAt = 1_000),
                UiToolCall(
                    "c2",
                    "read_file",
                    """{"path":"a"}""",
                    running = false,
                    output = "no such file",
                    isError = true,
                    startedAt = 1_100,
                    finishedAt = 1_400,
                ),
            ),
            running.last().toolCalls,
        )
    }

    @Test
    fun anAbortOrAnErrorEndsTheCurrentStep() {
        assertEquals(MessageStatus.Aborted, reduce(AgentStreamEvent.Aborted()).last().status)

        val failed =
            reduce(AgentStreamEvent.TextDelta("Sun"), AgentStreamEvent.Error("boom")).last()
        assertEquals(MessageStatus.Error, failed.status)
        assertEquals(UiText.Raw("boom"), failed.error)
        assertEquals("Sun", failed.content)
    }

    @Test
    fun startedAndUnknownEventsChangeNothing() {
        assertEquals(
            listOf(question, placeholder),
            reduce(AgentStreamEvent.Started("q1"), AgentStreamEvent.Unknown()),
        )
    }
}
