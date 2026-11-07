package dev.lemmahq.lemma.ui.session

import dev.lemmahq.lemma.client.sampleMessage
import dev.lemmahq.lemma.client.sampleProvider
import dev.lemmahq.lemma.data.ModelSelection
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ModelSelectionsTest {

    private val openai = sampleProvider("openai", "gpt-4o", "gpt-4o-mini")
    private val disabled = sampleProvider("disabled", "m1", enabled = false)
    private val empty = sampleProvider("empty")

    @Test
    fun theDefaultKeepsTheStoredModelWhileItIsOffered() {
        val stored = ModelSelection("openai", "gpt-4o-mini")

        assertEquals(stored, defaultSelection(listOf(openai), stored))
    }

    @Test
    fun theDefaultFallsBackToTheFirstModelOfTheFirstEnabledProviderWithModels() {
        val stored = ModelSelection("disabled", "m1")

        assertEquals(
            ModelSelection("openai", "gpt-4o"),
            defaultSelection(listOf(disabled, empty, openai), stored),
        )
        assertNull(defaultSelection(listOf(disabled, empty), stored))
    }

    @Test
    fun theLastUsedModelIsTheModelOfTheNewestReplyThatNamesOne() {
        val newestFirst =
            listOf(
                sampleMessage("4", "user"),
                sampleMessage("3", "assistant"),
                sampleMessage("2", "assistant", providerId = "openai", model = "gpt-4o-mini"),
                sampleMessage("1", "assistant", providerId = "openai", model = "gpt-4o"),
            )

        assertEquals(
            ModelSelection("openai", "gpt-4o-mini"),
            lastUsedSelection(newestFirst, listOf(openai)),
        )
    }

    @Test
    fun noModelIsLastUsedUnlessTheNewestReplyNamesAnOfferedModel() {
        val older = sampleMessage("1", "assistant", providerId = "openai", model = "gpt-4o")

        assertNull(lastUsedSelection(listOf(sampleMessage("2", "user")), listOf(openai)))
        assertNull(
            lastUsedSelection(
                listOf(
                    sampleMessage("2", "assistant", providerId = "disabled", model = "m1"),
                    older,
                ),
                listOf(openai, disabled),
            )
        )
        assertNull(
            lastUsedSelection(
                listOf(sampleMessage("2", "assistant", model = "gpt-4o"), older),
                listOf(openai),
            )
        )
    }
}
