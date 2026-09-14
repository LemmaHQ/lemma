package com.lemmaos.lemma.data

import com.russhwolf.settings.Settings

private const val KEY_REFRESH_TOKEN = "refresh_token"

class SessionStore(private val settings: Settings = Settings()) {

    @Volatile
    var accessToken: String? = null
        private set

    val refreshToken: String?
        get() = settings.getStringOrNull(KEY_REFRESH_TOKEN)

    fun update(accessToken: String, refreshToken: String) {
        this.accessToken = accessToken
        settings.putString(KEY_REFRESH_TOKEN, refreshToken)
    }

    fun clear() {
        accessToken = null
        settings.remove(KEY_REFRESH_TOKEN)
    }
}
