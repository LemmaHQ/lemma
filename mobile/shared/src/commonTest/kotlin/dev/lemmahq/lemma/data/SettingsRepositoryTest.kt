package dev.lemmahq.lemma.data

import com.russhwolf.settings.MapSettings
import dev.lemmahq.lemma.client.Connection
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SettingsRepositoryTest {

    @Test
    fun storesTheChosenConnection() {
        val repo = SettingsRepository(MapSettings(), InMemoryTokenStore())
        assertNull(repo.getConnection())

        repo.setConnection(Connection.Remote("http://192.168.1.100:1025"))
        assertEquals(Connection.Remote("http://192.168.1.100:1025"), repo.getConnection())

        repo.setConnection(Connection.Local)
        assertEquals(Connection.Local, repo.getConnection())

        repo.setConnection(null)
        assertNull(repo.getConnection())
    }

    @Test
    fun signedInFollowsTheStoredTokenPair() {
        val tokens = InMemoryTokenStore()
        val repo = SettingsRepository(MapSettings(), tokens)
        assertFalse(repo.signedIn.value)

        repo.setTokens("access-1", "refresh-1")
        assertTrue(repo.signedIn.value)
        assertEquals("access-1", repo.getAccessToken())
        assertEquals("refresh-1", repo.getRefreshToken())
        assertTrue(SettingsRepository(MapSettings(), tokens).signedIn.value)

        repo.clearAuth()
        assertFalse(repo.signedIn.value)
        assertNull(repo.getAccessToken())
        assertNull(repo.getRefreshToken())
        assertNull(tokens.load())
    }

    @Test
    fun appearanceDefaultsToSystemAndFollowsChanges() {
        val settings = MapSettings()
        val repo = SettingsRepository(settings, InMemoryTokenStore())
        assertEquals(ThemePreference.System, repo.theme.value)
        assertEquals(LanguagePreference.System, repo.language.value)

        repo.setTheme(ThemePreference.Dark)
        repo.setLanguage(LanguagePreference.Chinese)
        assertEquals(ThemePreference.Dark, repo.theme.value)
        assertEquals(LanguagePreference.Chinese, repo.language.value)

        val restored = SettingsRepository(settings, InMemoryTokenStore())
        assertEquals(ThemePreference.Dark, restored.theme.value)
        assertEquals(LanguagePreference.Chinese, restored.language.value)

        restored.setTheme(ThemePreference.Light)
        restored.setLanguage(LanguagePreference.English)
        assertEquals(ThemePreference.Light, restored.theme.value)
        assertEquals(LanguagePreference.English, restored.language.value)
    }

    @Test
    fun storesTheDefaultModel() {
        val repo = SettingsRepository(MapSettings(), InMemoryTokenStore())
        assertNull(repo.getModelSelection())

        repo.setModelSelection(ModelSelection("openai", "gpt-4o"))
        assertEquals(ModelSelection("openai", "gpt-4o"), repo.getModelSelection())
    }
}
