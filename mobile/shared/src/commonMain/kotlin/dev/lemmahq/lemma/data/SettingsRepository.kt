package dev.lemmahq.lemma.data

import com.russhwolf.settings.Settings
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

private const val KEY_DEFAULT_PROVIDER_ID = "lemma_default_provider_id"
private const val KEY_DEFAULT_MODEL = "lemma_default_model"
private const val KEY_THEME = "lemma_theme"
private const val KEY_LANGUAGE = "lemma_language"

/** The stored appearance and default model for the whole process. */
class SettingsRepository(private val settings: Settings) {
    private val _theme =
        MutableStateFlow(
            ThemePreference.valueOf(settings.getString(KEY_THEME, ThemePreference.System.name))
        )
    private val _language =
        MutableStateFlow(
            LanguagePreference.valueOf(
                settings.getString(KEY_LANGUAGE, LanguagePreference.System.name)
            )
        )

    val theme: StateFlow<ThemePreference> = _theme.asStateFlow()

    val language: StateFlow<LanguagePreference> = _language.asStateFlow()

    fun setTheme(preference: ThemePreference) {
        settings.putString(KEY_THEME, preference.name)
        _theme.value = preference
    }

    fun setLanguage(preference: LanguagePreference) {
        settings.putString(KEY_LANGUAGE, preference.name)
        _language.value = preference
    }

    fun getModelSelection(): ModelSelection? {
        val providerId = settings.getStringOrNull(KEY_DEFAULT_PROVIDER_ID) ?: return null
        return ModelSelection(providerId, settings.getString(KEY_DEFAULT_MODEL, ""))
    }

    fun setModelSelection(selection: ModelSelection) {
        settings.putString(KEY_DEFAULT_PROVIDER_ID, selection.providerId)
        settings.putString(KEY_DEFAULT_MODEL, selection.model)
    }
}
