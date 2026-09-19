package dev.lemmahq.lemma.data

import com.russhwolf.settings.Settings

interface SettingsRepository {
    fun getServerUrl(): String?
    fun setServerUrl(url: String?)
    fun getAccessToken(): String?
    fun setAccessToken(token: String?)
    fun getRefreshToken(): String?
    fun setRefreshToken(token: String?)
    fun getThemeMode(): String
    fun setThemeMode(mode: String)
    fun clearAuth()
}

class DefaultSettingsRepository(
    private val settings: Settings = Settings()
) : SettingsRepository {

    companion object {
        private const val KEY_SERVER_URL = "lemma_server_url"
        private const val KEY_ACCESS_TOKEN = "lemma_access_token"
        private const val KEY_REFRESH_TOKEN = "lemma_refresh_token"
        private const val KEY_THEME_MODE = "lemma_theme_mode"
        const val THEME_SYSTEM = "system"
        const val THEME_LIGHT = "light"
        const val THEME_DARK = "dark"
    }

    override fun getServerUrl(): String? {
        return settings.getStringOrNull(KEY_SERVER_URL)
    }

    override fun setServerUrl(url: String?) {
        if (url == null) {
            settings.remove(KEY_SERVER_URL)
        } else {
            settings.putString(KEY_SERVER_URL, url)
        }
    }

    override fun getAccessToken(): String? {
        return settings.getStringOrNull(KEY_ACCESS_TOKEN)
    }

    override fun setAccessToken(token: String?) {
        if (token == null) {
            settings.remove(KEY_ACCESS_TOKEN)
        } else {
            settings.putString(KEY_ACCESS_TOKEN, token)
        }
    }

    override fun getRefreshToken(): String? {
        return settings.getStringOrNull(KEY_REFRESH_TOKEN)
    }

    override fun setRefreshToken(token: String?) {
        if (token == null) {
            settings.remove(KEY_REFRESH_TOKEN)
        } else {
            settings.putString(KEY_REFRESH_TOKEN, token)
        }
    }

    override fun getThemeMode(): String {
        return settings.getString(KEY_THEME_MODE, THEME_SYSTEM)
    }

    override fun setThemeMode(mode: String) {
        settings.putString(KEY_THEME_MODE, mode)
    }

    override fun clearAuth() {
        settings.remove(KEY_ACCESS_TOKEN)
        settings.remove(KEY_REFRESH_TOKEN)
    }
}
