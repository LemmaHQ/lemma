package dev.lemmahq.lemma.ui.agent

import dev.lemmahq.lemma.ui.components.LemmaBubbleRole

internal data class UiMessage(
    val id: String,
    val role: LemmaBubbleRole,
    val text: String,
)
