package dev.lemmahq.lemma

import android.app.Application
import com.russhwolf.settings.SharedPreferencesSettings
import dev.lemmahq.lemma.data.SettingsRepository
import dev.lemmahq.lemma.engine.PlatformVerifier
import dev.lemmahq.lemma.network.AndroidConnector

/** Holds the settings and connector that every activity of the process shares. */
class LemmaApplication : Application() {

    val settings by lazy {
        SettingsRepository(
            SharedPreferencesSettings(
                getSharedPreferences("${packageName}_preferences", MODE_PRIVATE)
            )
        )
    }

    val connector by lazy { AndroidConnector(filesDir.absolutePath) }

    override fun onCreate() {
        super.onCreate()
        PlatformVerifier.install(this)
    }
}
