package com.lemmaos.lemma.data

import com.russhwolf.settings.Settings

private const val KEY_SERVER_URL = "server_url"

private val SERVER_URL_PATTERN = Regex("^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?(/.*)?$")

fun normalizeServerUrl(input: String): String? {
    val trimmed = input.trim().trimEnd('/')
    return if (SERVER_URL_PATTERN.matches(trimmed)) trimmed else null
}

class ServerConfigStore(private val settings: Settings = Settings()) {

    val serverUrl: String?
        get() = settings.getStringOrNull(KEY_SERVER_URL)

    fun save(serverUrl: String) {
        settings.putString(KEY_SERVER_URL, serverUrl)
    }

    fun clear() {
        settings.remove(KEY_SERVER_URL)
    }
}
