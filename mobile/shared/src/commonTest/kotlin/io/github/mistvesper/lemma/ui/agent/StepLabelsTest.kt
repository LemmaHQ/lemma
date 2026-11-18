package io.github.mistvesper.lemma.ui.agent

import io.github.mistvesper.lemma.i18n.UiText
import kotlin.test.Test
import kotlin.test.assertEquals
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.agent_self_healed
import lemma.mobile.shared.generated.resources.agent_summary_fetched_web
import lemma.mobile.shared.generated.resources.agent_summary_ran
import lemma.mobile.shared.generated.resources.agent_summary_read
import lemma.mobile.shared.generated.resources.agent_summary_searched_web
import lemma.mobile.shared.generated.resources.agent_summary_wrote
import lemma.mobile.shared.generated.resources.agent_thinking
import lemma.mobile.shared.generated.resources.agent_thinking_in_progress
import lemma.mobile.shared.generated.resources.agent_thought_duration
import lemma.mobile.shared.generated.resources.agent_tool_call_failed
import lemma.mobile.shared.generated.resources.agent_verb_bash
import lemma.mobile.shared.generated.resources.agent_verb_fetch
import lemma.mobile.shared.generated.resources.agent_verb_read
import lemma.mobile.shared.generated.resources.agent_verb_search
import lemma.mobile.shared.generated.resources.agent_verb_write

class StepLabelsTest {

    private fun tool(name: String, argument: String = "") =
        TurnStep("c-$name", name, argument, null, null, false, StepDetail.Output(""))

    private fun thinking(
        startedAt: Long? = null,
        finishedAt: Long? = null,
        running: Boolean = false,
    ) = TurnStep("t", null, "", startedAt, finishedAt, running, StepDetail.Prose(""))

    @Test
    fun eachStepIsLabeledByItsVerb() {
        assertEquals(
            listOf(
                UiText.Resource(Res.string.agent_thinking),
                UiText.Resource(Res.string.agent_verb_read),
                UiText.Resource(Res.string.agent_verb_write),
                UiText.Resource(Res.string.agent_verb_bash),
                UiText.Resource(Res.string.agent_verb_search),
                UiText.Resource(Res.string.agent_verb_fetch),
                UiText.Raw("custom"),
            ),
            listOf(
                    thinking(),
                    tool("read_file"),
                    tool("write_file"),
                    tool("bash"),
                    tool("web_search"),
                    tool("web_fetch"),
                    tool("custom"),
                )
                .map(::stepVerb),
        )
    }

    @Test
    fun aStepWithoutArgumentShowsThatItThinksOrItsToolName() {
        assertEquals(
            listOf(
                UiText.Raw("ls"),
                UiText.Resource(Res.string.agent_thinking_in_progress),
                UiText.Raw("bash"),
            ),
            listOf(tool("bash", "ls"), thinking(), tool("bash")).map(::stepArgument),
        )
    }

    @Test
    fun aFailureReadsCalmOnceLaterStepsFixedIt() {
        val failed = tool("bash").copy(isError = true)

        assertEquals(
            listOf(
                UiText.Resource(Res.string.agent_self_healed),
                UiText.Resource(Res.string.agent_tool_call_failed),
                null,
            ),
            listOf(failed.copy(selfHealed = true), failed, tool("bash")).map(::stepFailure),
        )
    }

    @Test
    fun theSummaryTellsHowLongTheReplyThoughtThenWhatEachToolDid() {
        assertEquals(
            listOf(
                UiText.Resource(Res.string.agent_thought_duration, listOf("3.8s")),
                UiText.Resource(Res.string.agent_summary_read, listOf("main.rs")),
                UiText.Resource(Res.string.agent_summary_read, listOf("read_file")),
                UiText.Resource(Res.string.agent_summary_wrote, listOf("notes.md")),
                UiText.Resource(Res.string.agent_summary_wrote, listOf("write_file")),
                UiText.Resource(Res.string.agent_summary_ran, listOf("cargo test")),
                UiText.Resource(Res.string.agent_summary_ran, listOf("bash")),
                UiText.Resource(Res.string.agent_summary_searched_web),
                UiText.Resource(Res.string.agent_summary_fetched_web),
                UiText.Raw("custom"),
            ),
            stepSummary(
                listOf(
                    thinking(1_000, 3_000),
                    tool("read_file", "src/main.rs"),
                    tool("read_file", "lib/main.rs"),
                    tool("read_file"),
                    tool("write_file", "docs/notes.md"),
                    tool("write_file"),
                    tool("bash", "cargo test"),
                    tool("bash"),
                    tool("web_search", "rust"),
                    tool("web_search", "kotlin"),
                    thinking(5_000, 6_800),
                    tool("web_fetch", "https://a.com"),
                    tool("custom"),
                    tool(""),
                )
            ),
        )
    }

    @Test
    fun thinkingReadsAsOngoingUntimedOrTimed() {
        assertEquals(
            listOf(
                listOf(UiText.Resource(Res.string.agent_thinking_in_progress)),
                listOf(UiText.Resource(Res.string.agent_thinking)),
                listOf(UiText.Resource(Res.string.agent_thought_duration, listOf("1ms"))),
                emptyList(),
            ),
            listOf(
                    listOf(thinking(1_000, 2_000), thinking(3_000, running = true)),
                    listOf(thinking(), thinking(finishedAt = 2_000), thinking(startedAt = 1_000)),
                    listOf(thinking(2_000, 1_000)),
                    listOf(tool("")),
                )
                .map(::stepSummary),
        )
    }
}
