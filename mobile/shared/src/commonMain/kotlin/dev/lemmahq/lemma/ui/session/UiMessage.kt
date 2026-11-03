package dev.lemmahq.lemma.ui.session

import dev.lemmahq.lemma.ui.components.LemmaBubbleRole

internal data class UiMessage(
    val id: String,
    val role: LemmaBubbleRole,
    val text: String,
)
