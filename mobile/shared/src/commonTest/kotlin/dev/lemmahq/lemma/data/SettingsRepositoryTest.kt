package dev.lemmahq.lemma.data

import com.russhwolf.settings.MapSettings
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SettingsRepositoryTest {

    @Test
    fun testServerUrlPersistence() {
        val repo = SettingsRepository(MapSettings())
        assertNull(repo.getServerUrl())

        repo.setServerUrl("http://192.168.1.100:1025")
        assertEquals("http://192.168.1.100:1025", repo.getServerUrl())

        repo.setServerUrl(null)
        assertNull(repo.getServerUrl())
    }

    @Test
    fun testAuthTokensPersistence() {
        val repo = SettingsRepository(MapSettings())
        assertNull(repo.getAccessToken())
        assertNull(repo.getRefreshToken())

        repo.setAccessToken("access_123")
        repo.setRefreshToken("refresh_456")
        assertEquals("access_123", repo.getAccessToken())
        assertEquals("refresh_456", repo.getRefreshToken())

        repo.clearAuth()
        assertNull(repo.getAccessToken())
        assertNull(repo.getRefreshToken())
    }
}
