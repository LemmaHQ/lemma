package io.github.mistvesper.lemma.ui.provider

import io.github.mistvesper.lemma.client.ApiFormat
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

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

    @Test
    fun baseUrlValidationAllowsHttpAndHttpsAndFlagsOnlyNonBlankInvalidValues() {
        assertFalse(isBaseUrlValid(""))
        assertFalse(isBaseUrlValid("api.example.com"))
        assertTrue(isBaseUrlValid(" http://localhost:8080/v1 "))
        assertTrue(isBaseUrlValid("https://api.example.com"))

        assertFalse(isBaseUrlInvalid(""))
        assertFalse(isBaseUrlInvalid("   "))
        assertTrue(isBaseUrlInvalid("ftp://files.example.com"))
        assertFalse(isBaseUrlInvalid("https://api.example.com"))
    }
}
