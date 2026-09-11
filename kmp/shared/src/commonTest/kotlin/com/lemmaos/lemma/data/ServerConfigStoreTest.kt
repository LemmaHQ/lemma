package com.lemmaos.lemma.data

import com.russhwolf.settings.MapSettings
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ServerConfigStoreTest {

    @Test
    fun normalizeAcceptsHttpUrlsWithHostAndOptionalPort() {
        assertEquals("http://127.0.0.1:1025", normalizeServerUrl("http://127.0.0.1:1025"))
        assertEquals("https://example.com", normalizeServerUrl("https://example.com/"))
        assertEquals("http://localhost:8080", normalizeServerUrl("  http://localhost:8080  "))
    }

    @Test
    fun normalizeRejectsMalformedUrls() {
        assertNull(normalizeServerUrl(""))
        assertNull(normalizeServerUrl("ftp://example.com"))
        assertNull(normalizeServerUrl("example.com"))
        assertNull(normalizeServerUrl("http://"))
    }

    @Test
    fun storePersistsAndClearsServerUrl() {
        val store = ServerConfigStore(MapSettings())
        assertNull(store.serverUrl)
        store.save("http://127.0.0.1:1025")
        assertEquals("http://127.0.0.1:1025", store.serverUrl)
        store.clear()
        assertNull(store.serverUrl)
    }
}
