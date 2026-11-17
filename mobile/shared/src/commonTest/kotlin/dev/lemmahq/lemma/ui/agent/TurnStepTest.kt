package dev.lemmahq.lemma.ui.agent

import dev.lemmahq.lemma.client.MessageStatus
import kotlin.test.Test
import kotlin.test.assertEquals

class TurnStepTest {

    private fun assistant(
        id: String,
        status: MessageStatus = MessageStatus.Done,
        thinking: String = "",
        toolCalls: List<UiToolCall> = emptyList(),
    ) =
        UiMessage(
            id,
            MessageRole.Assistant,
            "",
            thinking = thinking,
            status = status,
            toolCalls = toolCalls,
        )

    private fun call(
        id: String,
        name: String = "bash",
        isError: Boolean = false,
        running: Boolean = false,
    ) = UiToolCall(id, name, "{}", running, output = "out", isError = isError)

    @Test
    fun toolArgumentsShowTheirPathCommandQueryOrUrl() {
        assertEquals(
            listOf(
                "src/app.ts",
                "notes.txt",
                "git status",
                "lemma architecture",
                "https://example.com",
                """{"x":1}""",
                """{"path":""}""",
                """{"command":42}""",
                "not-json",
                "[1,2]",
            ),
            listOf(
                    "read_file" to """{"path":"src/app.ts"}""",
                    "write_file" to """{"path":"notes.txt","content":"hi"}""",
                    "bash" to """{"command":"git status"}""",
                    "web_search" to """{"query":"lemma architecture"}""",
                    "web_fetch" to """{"url":"https://example.com"}""",
                    "custom_tool" to """{"x":1}""",
                    "read_file" to """{"path":""}""",
                    "bash" to """{"command":42}""",
                    "read_file" to "not-json",
                    "read_file" to "[1,2]",
                )
                .map { (name, arguments) -> formatToolArgument(name, arguments) },
        )
    }

    @Test
    fun thinkingBecomesAProseStepNamedByItsFirstLine() {
        val steps =
            buildTurnSteps(
                listOf(
                    assistant(
                            "a1",
                            status = MessageStatus.Streaming,
                            thinking = "\n  First line\nSecond line",
                        )
                        .copy(thinkingStartedAt = 1_000),
                    assistant("a2", thinking = "   \n  ")
                        .copy(thinkingStartedAt = 1_000, thinkingFinishedAt = 2_000),
                    assistant("a3", status = MessageStatus.Streaming)
                        .copy(thinkingStartedAt = 3_000),
                    assistant("a4", status = MessageStatus.Streaming),
                )
            )

        assertEquals(
            listOf(
                TurnStep(
                    "a1:thinking",
                    null,
                    "First line",
                    1_000,
                    null,
                    true,
                    StepDetail.Prose("\n  First line\nSecond line"),
                ),
                TurnStep("a2:thinking", null, "", 1_000, 2_000, false, StepDetail.Prose("   \n  ")),
                TurnStep("a3:thinking", null, "", 3_000, null, true, StepDetail.Prose("")),
            ),
            steps,
        )
        assertEquals(true, steps.first().plainArgument)
    }

    @Test
    fun stepsFollowTheOrderTheyHappenedAcrossMessages() {
        val steps =
            buildTurnSteps(
                listOf(
                    assistant("a1", thinking = "Plan", toolCalls = listOf(call("c1"))),
                    assistant(
                        "a2",
                        status = MessageStatus.Streaming,
                        thinking = "More",
                        toolCalls = listOf(call("c2", "web_search", running = true)),
                    ),
                )
            )

        assertEquals(listOf("a1:thinking", "c1", "a2:thinking", "c2"), steps.map { it.id })
        assertEquals(listOf(true, false, true, true), steps.map { it.plainArgument })
        assertEquals(StepDetail.Output("out"), steps[1].detail)
        assertEquals(emptyList<TurnStep>(), buildTurnSteps(emptyList()))
    }

    @Test
    fun aFailedCallIsSelfHealedOnlyWhenALaterCallSucceedsOrALaterStepSettles() {
        fun healed(vararg messages: UiMessage) =
            buildTurnSteps(messages.toList()).map { it.isError to it.selfHealed }

        assertEquals(
            listOf(true to true, false to false),
            healed(assistant("a1", toolCalls = listOf(call("c1", isError = true), call("c2")))),
        )
        assertEquals(
            listOf(true to true),
            healed(
                assistant("a1", toolCalls = listOf(call("c1", isError = true))),
                assistant("a2"),
            ),
        )
        assertEquals(
            listOf(true to false),
            healed(
                assistant("a1", toolCalls = listOf(call("c1", isError = true))),
                assistant("a2", status = MessageStatus.Error),
            ),
        )
        assertEquals(
            listOf(true to false, false to false),
            healed(
                assistant(
                    "a1",
                    status = MessageStatus.Streaming,
                    toolCalls = listOf(call("c1", isError = true), call("c2", running = true)),
                )
            ),
        )
    }
}
