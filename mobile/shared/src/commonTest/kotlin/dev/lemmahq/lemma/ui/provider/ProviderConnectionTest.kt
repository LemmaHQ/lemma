package dev.lemmahq.lemma.ui.provider

import kotlin.test.Test
import kotlin.test.assertEquals

class ProviderConnectionTest {

    @Test
    fun eachKindHintsItsOwnRequestPath() {
        assertEquals(
            listOf("/chat/completions", "/v1/messages", "/v1beta/models/{model}:…"),
            PROVIDER_KINDS.map { connectionPlaceholders(it).apiPath },
        )
    }
}
