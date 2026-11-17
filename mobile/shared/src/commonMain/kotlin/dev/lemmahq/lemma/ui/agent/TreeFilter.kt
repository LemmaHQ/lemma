package dev.lemmahq.lemma.ui.agent

import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.session_tree_filter_all
import lemma.mobile.shared.generated.resources.session_tree_filter_labeled
import lemma.mobile.shared.generated.resources.session_tree_filter_questions
import org.jetbrains.compose.resources.StringResource

/** Which rows the session tree sheet lists, named by [label]. */
internal enum class TreeFilter(val label: StringResource) {
    All(Res.string.session_tree_filter_all),
    Questions(Res.string.session_tree_filter_questions),
    Labeled(Res.string.session_tree_filter_labeled);

    /** Whether [row] passes this filter and its [title] or label contains [query], in any case. */
    fun shows(row: TreeRow, title: String, query: String): Boolean =
        when (this) {
            All -> true
            Questions -> row.question
            Labeled -> row.label != null
        } &&
            (title.contains(query, ignoreCase = true) ||
                row.label.orEmpty().contains(query, ignoreCase = true))
}
