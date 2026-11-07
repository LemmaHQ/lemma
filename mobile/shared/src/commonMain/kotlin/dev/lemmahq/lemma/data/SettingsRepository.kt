package dev.lemmahq.lemma.data

import com.russhwolf.settings.Settings
import dev.lemmahq.lemma.client.Connection
import kotlin.concurrent.Volatile
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

private const val KEY_APP_MODE = "lemma_app_mode"
private const val KEY_SERVER_URL = "lemma_server_url"
private const val KEY_DEFAULT_PROVIDER_ID = "lemma_default_provider_id"
private const val KEY_DEFAULT_MODEL = "lemma_default_model"
private const val KEY_THEME = "lemma_theme"
private const val KEY_LANGUAGE = "lemma_language"
private const val MODE_REMOTE = "remote"
private const val MODE_LOCAL = "local"

/** The stored connection, appearance, token pair, and default model for the whole process. */
class SettingsRepository(private val settings: Settings, private val tokenStore: TokenStore) {
    @Volatile private var tokens: TokenPair? = tokenStore.load()
    private val _signedIn = MutableStateFlow(tokens != null)
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

    /** Whether a token pair is stored; turns false when the pair is cleared. */
    val signedIn: StateFlow<Boolean> = _signedIn.asStateFlow()

    val theme: StateFlow<ThemePreference> = _theme.asStateFlow()

    val language: StateFlow<LanguagePreference> = _language.asStateFlow()

    fun getConnection(): Connection? {
        val serverUrl = settings.getStringOrNull(KEY_SERVER_URL)
        return when (settings.getStringOrNull(KEY_APP_MODE)) {
            MODE_LOCAL -> Connection.Local
            else -> serverUrl?.let { Connection.Remote(it) }
        }
    }

    /** Stores [connection]; null forgets the connection and its server URL. */
    fun setConnection(connection: Connection?) {
        when (connection) {
            null -> {
                settings.remove(KEY_APP_MODE)
                settings.remove(KEY_SERVER_URL)
            }
            Connection.Local -> settings.putString(KEY_APP_MODE, MODE_LOCAL)
            is Connection.Remote -> {
                settings.putString(KEY_APP_MODE, MODE_REMOTE)
                settings.putString(KEY_SERVER_URL, connection.serverUrl)
            }
        }
    }

    fun getAccessToken(): String? = tokens?.accessToken

    fun getRefreshToken(): String? = tokens?.refreshToken

    fun setTokens(accessToken: String, refreshToken: String) {
        val pair = TokenPair(accessToken, refreshToken)
        tokenStore.save(pair)
        tokens = pair
        _signedIn.value = true
    }

    fun clearAuth() {
        tokenStore.clear()
        tokens = null
        _signedIn.value = false
    }

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
