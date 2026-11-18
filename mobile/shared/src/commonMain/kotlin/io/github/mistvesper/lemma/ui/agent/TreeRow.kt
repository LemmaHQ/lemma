package io.github.mistvesper.lemma.ui.agent

import io.github.mistvesper.lemma.i18n.UiText

/**
 * A row of the session tree: a [question], or a reply standing for an assistant message with its
 * tool messages and later steps, known by its last message [id]. [depth] counts the forks above the
 * row; [onPath] marks the shown path and [isLeaf] a row that ends a path.
 */
internal data class TreeRow(
    val id: String,
    val question: Boolean,
    val title: UiText,
    val label: String?,
    val depth: Int,
    val onPath: Boolean,
    val isLeaf: Boolean,
)
