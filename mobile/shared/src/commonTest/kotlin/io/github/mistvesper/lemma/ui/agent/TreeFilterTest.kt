package io.github.mistvesper.lemma.ui.agent

import io.github.mistvesper.lemma.i18n.UiText
import kotlin.test.Test
import kotlin.test.assertEquals

class TreeFilterTest {

    private val question = TreeRow("q1", true, UiText.Raw("Plan"), null, 0, true, false)
    private val reply = TreeRow("a1", false, UiText.Raw("Done"), "Keep", 0, true, true)

    private fun shown(filter: TreeFilter, query: String = "") =
        listOf(question, reply).filter { filter.shows(it, (it.title as UiText.Raw).text, query) }

    @Test
    fun filtersKeepAllRowsQuestionsOrLabeledRows() {
        assertEquals(listOf(question, reply), shown(TreeFilter.All))
        assertEquals(listOf(question), shown(TreeFilter.Questions))
        assertEquals(listOf(reply), shown(TreeFilter.Labeled))
    }

    @Test
    fun aQueryMatchesTheTitleOrTheLabelInAnyCase() {
        assertEquals(listOf(question), shown(TreeFilter.All, "plan"))
        assertEquals(listOf(reply), shown(TreeFilter.All, "KEEP"))
        assertEquals(emptyList(), shown(TreeFilter.All, "nothing"))
    }
}
