package dev.lemmahq.lemma.ui.session

import dev.lemmahq.lemma.client.sampleProvider
import kotlin.test.Test
import kotlin.test.assertEquals

class MessageListTest {

    private val reply = UiMessage("a1", MessageRole.Assistant, "Hi", providerId = "openai")

    @Test
    fun aReplyNamesItsProviderWhenTheProviderIsKnownAndNamed() {
        val named = sampleProvider("openai")

        assertEquals(
            listOf(null, null, "gpt-4o", "gpt-4o", "openai · gpt-4o"),
            listOf(
                    reply to listOf(named),
                    reply.copy(model = "") to listOf(named),
                    reply.copy(model = "gpt-4o") to emptyList(),
                    reply.copy(model = "gpt-4o") to listOf(named.copy(name = "")),
                    reply.copy(model = "gpt-4o") to listOf(sampleProvider("other"), named),
                )
                .map { (message, providers) -> messageSource(message, providers) },
        )
    }
}
