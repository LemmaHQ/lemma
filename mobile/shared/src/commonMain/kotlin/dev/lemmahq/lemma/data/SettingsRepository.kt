package dev.lemmahq.lemma.data

import com.russhwolf.settings.Settings

class SettingsRepository(private val settings: Settings = Settings()) {

    companion object {
        private const val KEY_APP_MODE = "lemma_app_mode"
        private const val KEY_SERVER_URL = "lemma_server_url"
        private const val KEY_ACCESS_TOKEN = "lemma_access_token"
        private const val KEY_REFRESH_TOKEN = "lemma_refresh_token"
        private const val KEY_DEFAULT_PROVIDER_ID = "lemma_default_provider_id"
        private const val KEY_DEFAULT_MODEL = "lemma_default_model"
        const val MODE_REMOTE = "remote"
        const val MODE_LOCAL = "local"
    }

    fun getAppMode(): String? {
        return settings.getStringOrNull(KEY_APP_MODE)
    }

    fun setAppMode(mode: String?) {
        if (mode == null) {
            settings.remove(KEY_APP_MODE)
        } else {
            settings.putString(KEY_APP_MODE, mode)
        }
    }

    fun getServerUrl(): String? {
        return settings.getStringOrNull(KEY_SERVER_URL)
    }

    fun setServerUrl(url: String?) {
        if (url == null) {
            settings.remove(KEY_SERVER_URL)
        } else {
            settings.putString(KEY_SERVER_URL, url)
        }
    }

    fun getAccessToken(): String? {
        return settings.getStringOrNull(KEY_ACCESS_TOKEN)
    }

    fun setAccessToken(token: String?) {
        if (token == null) {
            settings.remove(KEY_ACCESS_TOKEN)
        } else {
            settings.putString(KEY_ACCESS_TOKEN, token)
        }
    }

    fun getRefreshToken(): String? {
        return settings.getStringOrNull(KEY_REFRESH_TOKEN)
    }

    fun setRefreshToken(token: String?) {
        if (token == null) {
            settings.remove(KEY_REFRESH_TOKEN)
        } else {
            settings.putString(KEY_REFRESH_TOKEN, token)
        }
    }

    fun getDefaultProviderId(): String? {
        return settings.getStringOrNull(KEY_DEFAULT_PROVIDER_ID)
    }

    fun setDefaultProviderId(providerId: String?) {
        if (providerId == null) {
            settings.remove(KEY_DEFAULT_PROVIDER_ID)
        } else {
            settings.putString(KEY_DEFAULT_PROVIDER_ID, providerId)
        }
    }

    fun getDefaultModel(): String? {
        return settings.getStringOrNull(KEY_DEFAULT_MODEL)
    }

    fun setDefaultModel(model: String?) {
        if (model == null) {
            settings.remove(KEY_DEFAULT_MODEL)
        } else {
            settings.putString(KEY_DEFAULT_MODEL, model)
        }
    }

    fun clearAuth() {
        settings.remove(KEY_ACCESS_TOKEN)
        settings.remove(KEY_REFRESH_TOKEN)
    }
}
