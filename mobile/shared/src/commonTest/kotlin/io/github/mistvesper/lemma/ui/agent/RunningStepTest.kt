package io.github.mistvesper.lemma.ui.agent

import io.github.mistvesper.lemma.i18n.UiText
import kotlin.test.Test
import kotlin.test.assertEquals
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.agent_reconnecting
import lemma.mobile.shared.generated.resources.agent_running_tool
import lemma.mobile.shared.generated.resources.agent_thinking_in_progress

class RunningStepTest {

    private val thinking = UiText.Resource(Res.string.agent_thinking_in_progress)
    private val reply =
        UiMessage(
            "a1",
            MessageRole.Assistant,
            "",
            toolCalls =
                listOf(
                    UiToolCall("c1", "read_file", "{}", running = false),
                    UiToolCall("c2", "bash", "{}", running = true),
                    UiToolCall("c3", "web_fetch", "{}", running = true),
                ),
        )

    @Test
    fun theStepNamesTheFirstRunningToolElseThinking() {
        assertEquals(
            listOf(
                UiText.Resource(Res.string.agent_running_tool, listOf("bash")),
                thinking,
                thinking,
            ),
            listOf(reply, reply.copy(toolCalls = emptyList()), null).map { runningStep(it, null) },
        )
    }

    @Test
    fun aBrokenStreamShowsTheEventItResumesFrom() {
        assertEquals(
            UiText.Resource(Res.string.agent_reconnecting, listOf(3L)),
            runningStep(reply, 3L),
        )
    }
}
