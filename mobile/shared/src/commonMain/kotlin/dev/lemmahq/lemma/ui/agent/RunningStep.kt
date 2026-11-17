package dev.lemmahq.lemma.ui.agent

import dev.lemmahq.lemma.i18n.UiText
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.agent_reconnecting
import lemma.mobile.shared.generated.resources.agent_running_tool
import lemma.mobile.shared.generated.resources.agent_thinking_in_progress

/**
 * What the running turn does now: resuming its broken stream from event [reconnectOffset], else
 * running the first running tool of [reply], else thinking.
 */
internal fun runningStep(reply: UiMessage?, reconnectOffset: Long?): UiText {
    if (reconnectOffset != null) {
        return UiText.Resource(Res.string.agent_reconnecting, listOf(reconnectOffset))
    }
    val tool = reply?.toolCalls.orEmpty().firstOrNull { it.running }
    return if (tool == null) {
        UiText.Resource(Res.string.agent_thinking_in_progress)
    } else {
        UiText.Resource(Res.string.agent_running_tool, listOf(tool.name))
    }
}
