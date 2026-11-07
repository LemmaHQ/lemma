package dev.lemmahq.lemma.i18n

import dev.lemmahq.lemma.client.ServiceFailure
import kotlin.test.Test
import kotlin.test.assertEquals

class ErrorTextTest {

    @Test
    fun everyFailureHasItsOwnMessage() {
        val messages = ServiceFailure.entries.map(::errorText)

        assertEquals(messages.size, messages.toSet().size)
    }
}
