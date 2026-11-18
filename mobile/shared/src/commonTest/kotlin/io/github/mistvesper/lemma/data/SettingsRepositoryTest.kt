package io.github.mistvesper.lemma.data

import com.russhwolf.settings.MapSettings
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SettingsRepositoryTest {

    @Test
    fun appearanceDefaultsToSystemAndFollowsChanges() {
        val settings = MapSettings()
        val repo = SettingsRepository(settings)
        assertEquals(ThemePreference.System, repo.theme.value)
        assertEquals(LanguagePreference.System, repo.language.value)

        repo.setTheme(ThemePreference.Dark)
        repo.setLanguage(LanguagePreference.Chinese)
        assertEquals(ThemePreference.Dark, repo.theme.value)
        assertEquals(LanguagePreference.Chinese, repo.language.value)

        val restored = SettingsRepository(settings)
        assertEquals(ThemePreference.Dark, restored.theme.value)
        assertEquals(LanguagePreference.Chinese, restored.language.value)

        restored.setTheme(ThemePreference.Light)
        restored.setLanguage(LanguagePreference.English)
        assertEquals(ThemePreference.Light, restored.theme.value)
        assertEquals(LanguagePreference.English, restored.language.value)
    }

    @Test
    fun storesTheDefaultModel() {
        val repo = SettingsRepository(MapSettings())
        assertNull(repo.getModelSelection())

        repo.setModelSelection(ModelSelection("openai", "gpt-4o"))
        assertEquals(ModelSelection("openai", "gpt-4o"), repo.getModelSelection())
    }
}
