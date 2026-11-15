package dev.lemmahq.lemma.ui.provider

import dev.lemmahq.lemma.client.ApiFormat
import kotlin.test.Test
import kotlin.test.assertEquals

class ProviderConnectionTest {

    @Test
    fun eachApiFormatHintsItsOwnBaseUrlAndRequestPath() {
        assertEquals(
            listOf(
                ConnectionPlaceholders("https://api.example.com/v1", "/chat/completions"),
                ConnectionPlaceholders("https://api.example.com", "/v1/messages"),
                ConnectionPlaceholders("https://api.example.com", "/v1beta/models/{model}:…"),
            ),
            ApiFormat.entries.map { connectionPlaceholders(it) },
        )
    }
}
