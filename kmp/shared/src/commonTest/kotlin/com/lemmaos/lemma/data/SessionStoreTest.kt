package com.lemmaos.lemma.data

import com.russhwolf.settings.MapSettings
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SessionStoreTest {

    @Test
    fun updateStoresAccessTokenInMemoryAndRefreshTokenInSettings() {
        val store = SessionStore(MapSettings())
        assertNull(store.accessToken)
        assertNull(store.refreshToken)

        store.update("access", "refresh")

        assertEquals("access", store.accessToken)
        assertEquals("refresh", store.refreshToken)
    }

    @Test
    fun clearDropsBothTokens() {
        val store = SessionStore(MapSettings())
        store.update("access", "refresh")

        store.clear()

        assertNull(store.accessToken)
        assertNull(store.refreshToken)
    }
}
