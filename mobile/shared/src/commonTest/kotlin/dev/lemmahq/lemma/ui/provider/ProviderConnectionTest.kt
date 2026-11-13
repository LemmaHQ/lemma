package dev.lemmahq.lemma.ui.provider

import kotlin.test.Test
import kotlin.test.assertEquals

class ProviderConnectionTest {

    @Test
    fun eachApiFormatHintsItsOwnRequestPath() {
        assertEquals(
            listOf("/chat/completions", "/v1/messages", "/v1beta/models/{model}:…"),
            API_FORMATS.map { connectionPlaceholders(it).apiPath },
        )
    }
}
