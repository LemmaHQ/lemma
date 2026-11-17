package dev.lemmahq.lemma.ui.agent

import dev.lemmahq.lemma.i18n.UiText
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

/** The short verb that labels [step]: thinking, the tool's action, or an unknown tool's name. */
internal fun stepVerb(step: TurnStep): UiText =
    when (step.toolName) {
        null -> UiText.Resource(Res.string.agent_thinking)
        "read_file" -> UiText.Resource(Res.string.agent_verb_read)
        "write_file" -> UiText.Resource(Res.string.agent_verb_write)
        "bash" -> UiText.Resource(Res.string.agent_verb_bash)
        "web_search" -> UiText.Resource(Res.string.agent_verb_search)
        "web_fetch" -> UiText.Resource(Res.string.agent_verb_fetch)
        else -> UiText.Raw(step.toolName)
    }

/** The text after [step]'s verb: its argument, or, without one, that it thinks or the tool name. */
internal fun stepArgument(step: TurnStep): UiText =
    when {
        step.argument.isNotEmpty() -> UiText.Raw(step.argument)
        step.toolName == null -> UiText.Resource(Res.string.agent_thinking_in_progress)
        else -> UiText.Raw(step.toolName)
    }

/** How [step] failed, calm when later steps fixed it; null for a step that did not fail. */
internal fun stepFailure(step: TurnStep): UiText? =
    when {
        step.selfHealed -> UiText.Resource(Res.string.agent_self_healed)
        step.isError -> UiText.Resource(Res.string.agent_tool_call_failed)
        else -> null
    }

/**
 * The parts of a timeline summary: how long the reply thought, then each distinct thing its tools
 * did, such as reading a file or searching the web; empty for steps of unnamed tools only.
 */
internal fun stepSummary(steps: List<TurnStep>): List<UiText> {
    val thinking = steps.filter { it.toolName == null }
    val tools = steps.mapNotNull { step -> step.toolName?.let { toolSummary(it, step.argument) } }
    return (listOfNotNull(thinking.takeIf { it.isNotEmpty() }?.let(::thinkingSummary)) + tools)
        .distinct()
}

private fun thinkingSummary(steps: List<TurnStep>): UiText {
    val durations = steps.mapNotNull { step ->
        step.startedAt?.let { start -> step.finishedAt?.let { (it - start).coerceAtLeast(0) } }
    }
    return when {
        steps.any { it.running } -> UiText.Resource(Res.string.agent_thinking_in_progress)
        durations.isNotEmpty() ->
            UiText.Resource(
                Res.string.agent_thought_duration,
                listOf(formatDuration(durations.sum())),
            )
        else -> UiText.Resource(Res.string.agent_thinking)
    }
}

private fun toolSummary(name: String, argument: String): UiText? =
    when (name) {
        "read_file" ->
            UiText.Resource(Res.string.agent_summary_read, listOf(fileTarget(name, argument)))
        "write_file" ->
            UiText.Resource(Res.string.agent_summary_wrote, listOf(fileTarget(name, argument)))
        "bash" -> UiText.Resource(Res.string.agent_summary_ran, listOf(argument.ifEmpty { name }))
        "web_search" -> UiText.Resource(Res.string.agent_summary_searched_web)
        "web_fetch" -> UiText.Resource(Res.string.agent_summary_fetched_web)
        else -> name.takeIf { it.isNotEmpty() }?.let(UiText::Raw)
    }

private fun fileTarget(name: String, argument: String) =
    if (argument.isEmpty()) name else lastPathSegment(argument)
