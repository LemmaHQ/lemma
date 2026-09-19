package dev.lemmahq.lemma.data

import com.russhwolf.settings.MapSettings
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SettingsRepositoryTest {

    @Test
    fun testServerUrlPersistence() {
        val repo = DefaultSettingsRepository(MapSettings())
        assertNull(repo.getServerUrl())

        repo.setServerUrl("http://192.168.1.100:1025")
        assertEquals("http://192.168.1.100:1025", repo.getServerUrl())

        repo.setServerUrl(null)
        assertNull(repo.getServerUrl())
    }

    @Test
    fun testAuthTokensPersistence() {
        val repo = DefaultSettingsRepository(MapSettings())
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

    @Test
    fun testThemeModeDefault() {
        val repo = DefaultSettingsRepository(MapSettings())
        assertEquals(DefaultSettingsRepository.THEME_SYSTEM, repo.getThemeMode())

        repo.setThemeMode(DefaultSettingsRepository.THEME_DARK)
        assertEquals(DefaultSettingsRepository.THEME_DARK, repo.getThemeMode())
    }
}
